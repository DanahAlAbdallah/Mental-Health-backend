import type { Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { isNewStatus, isValidId } from "../validators/sessions";

// A CLIENT CANNOT HOLD MORE THAN THIS MANY UNANSWERED BOOKINGS AT ONCE
const MAX_PENDING_PER_CLIENT = 3;

// ADDS THE THERAPIST'S AND THE PATIENT'S NAMES TO EACH SESSION.
// ONLY NAMES ARE ADDED, NEVER EMAILS OR PHONES
async function addNames<T extends { therapistId: string; patientId: string }>(
  sessions: T[],
) {
  const ids = [
    ...new Set(sessions.flatMap((s) => [s.therapistId, s.patientId])),
  ];

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((user) => [user.id, user.name]));

  return sessions.map((session) => ({
    ...session,
    therapistName: names.get(session.therapistId) ?? null,
    patientName: names.get(session.patientId) ?? null,
  }));
}

// BOOK A SESSION (CLIENT ONLY). THE SLOT IS RESERVED AND THE SESSION CREATED
// TOGETHER, SO TWO CLIENTS CAN NEVER TAKE THE SAME SLOT
export async function bookSession(req: AuthRequest, res: Response) {
  const { slotId } = req.body ?? {};

  if (!isValidId(slotId)) {
    return res.status(400).json({ error: "A valid slotId is required" });
  }

  const cleanSlotId = slotId.trim();
  const patientId = req.user!.id;

  try {
    // STOPS ONE CLIENT FROM BLOCKING ALL OF A THERAPIST'S SLOTS
    const pendingCount = await prisma.session.count({
      where: { patientId, status: "pending" },
    });
    if (pendingCount >= MAX_PENDING_PER_CLIENT) {
      return res.status(409).json({
        error: `You can have at most ${MAX_PENDING_PER_CLIENT} pending sessions. Wait for an answer or cancel one.`,
      });
    }

    const slot = await prisma.availabilitySlot.findUnique({
      where: { id: cleanSlotId },
    });

    if (!slot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    if (slot.isBooked) {
      return res.status(409).json({ error: "Slot is already booked" });
    }

    const session = await prisma.$transaction(async (tx) => {
      // RESERVE THE SLOT ONLY IF IT IS STILL AVAILABLE
      const reservation = await tx.availabilitySlot.updateMany({
        where: { id: cleanSlotId, isBooked: false },
        data: { isBooked: true },
      });

      // ANOTHER REQUEST MAY HAVE RESERVED IT FIRST
      if (reservation.count !== 1) {
        return null;
      }

      return tx.session.create({
        data: {
          therapistId: slot.therapistId,
          patientId,
          slotId: slot.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: "pending",
        },
      });
    });

    if (!session) {
      return res.status(409).json({
        error: "This slot is no longer available. Please choose another time.",
      });
    }

    return res.status(201).json(session);
  } catch (err) {
    console.error("Failed to book session:", err);
    return res.status(500).json({ error: "Failed to book session" });
  }
}

// A CLIENT SEES THEIR OWN SESSIONS, A THERAPIST THEIR OWN, AN ADMIN ALL.
// THE NEWEST COME FIRST AND EACH SESSION INCLUDES THE NAMES OF BOTH PEOPLE
export async function listMySessions(req: AuthRequest, res: Response) {
  const { role, id } = req.user!;

  const where =
    role === "admin"
      ? {}
      : role === "therapist"
        ? { therapistId: id }
        : { patientId: id };

  try {
    const sessions = await prisma.session.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(await addNames(sessions));
  } catch (err) {
    console.error("Failed to fetch sessions:", err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
}

// THE THERAPIST CAN CONFIRM, REJECT OR CANCEL. THE CLIENT CAN ONLY CANCEL THEIR OWN.
// WHEN A SESSION IS REJECTED OR CANCELLED, ITS SLOT BECOMES AVAILABLE AGAIN
export async function updateSessionStatus(req: AuthRequest, res: Response) {
  const { status } = req.body ?? {};

  if (!isNewStatus(status)) {
    return res.status(400).json({
      error: "Status must be one of: confirmed, rejected, cancelled",
    });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id as string },
    });

    const { id: userId, role } = req.user!;
    const isAdmin = role === "admin";
    const isTherapistOwner = session?.therapistId === userId;
    const isPatientOwner = session?.patientId === userId;

    // SAME ANSWER FOR "DOESN'T EXIST" AND "NOT YOURS", SO IDS CAN'T BE PROBED
    if (!session || (!isAdmin && !isTherapistOwner && !isPatientOwner)) {
      return res.status(404).json({ error: "Session not found" });
    }

    // A CLIENT CAN ONLY CANCEL, NOT CONFIRM OR REJECT
    if (!isAdmin && !isTherapistOwner && status !== "cancelled") {
      return res
        .status(403)
        .json({ error: "Clients can only cancel their own sessions" });
    }

    // CONFIRM AND REJECT ONLY WORK ON PENDING SESSIONS.
    // CANCEL WORKS ON PENDING OR CONFIRMED ONES. NOTHING CHANGES AFTER REJECTED OR CANCELLED
    const canChange =
      status === "cancelled"
        ? ["pending", "confirmed"].includes(session.status)
        : session.status === "pending";

    if (!canChange) {
      return res.status(409).json({
        error: `A ${session.status} session cannot be changed to ${status}`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // CHANGE THE STATUS ONLY IF IT IS STILL WHAT WE READ (NOBODY ELSE CHANGED IT FIRST)
      const result = await tx.session.updateMany({
        where: { id: session.id, status: session.status },
        data: { status },
      });

      if (result.count !== 1) return null;

      // REJECTED OR CANCELLED: THE TIME SLOT CAN BE BOOKED AGAIN
      if (status !== "confirmed") {
        await tx.availabilitySlot.updateMany({
          where: { id: session.slotId },
          data: { isBooked: false },
        });
      }

      return tx.session.findUnique({ where: { id: session.id } });
    });

    if (!updated) {
      return res
        .status(409)
        .json({ error: "This session was just changed. Please refresh." });
    }

    res.json(updated);
  } catch (err) {
    console.error("Failed to update session:", err);
    res.status(500).json({ error: "Failed to update session" });
  }
}
