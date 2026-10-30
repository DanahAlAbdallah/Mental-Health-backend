import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "../middleware/auth";

const router = Router();


// THE STATUSES A SESSION CAN BE CHANGED TO ("pending" IS ONLY SET WHEN BOOKING)
const NEW_STATUSES = ["confirmed", "rejected", "cancelled"];

// ADDS THE THERAPIST'S AND THE PATIENT'S NAMES TO EACH SESSION, SO THE PAGES CAN SHOW
// WHO IS WHO. ONLY NAMES ARE ADDED, NEVER EMAILS OR PHONES
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
router.post(
  "/",
  authenticate,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    const { slotId } = req.body;

    if (typeof slotId !== "string" || !slotId.trim()) {
      return res.status(400).json({ error: "A valid slotId is required" });
    }

    try {
      const slot = await prisma.availabilitySlot.findUnique({
        where: { id: slotId },
      });

      if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
      }

      if (slot.isBooked) {
        return res.status(409).json({ error: "Slot is already booked" });
      }

      const session = await prisma.$transaction(async (tx) => {
        // Reserve the slot only if it is still available.
        const reservation = await tx.availabilitySlot.updateMany({
          where: { id: slotId, isBooked: false },
          data: { isBooked: true },
        });

        // Another request may have reserved it first.
        if (reservation.count !== 1) {
          return null;
        }

        return tx.session.create({
          data: {
            therapistId: slot.therapistId,
            patientId: req.user!.id,
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
          error:
            "This slot is no longer available. Please choose another time.",
        });
      }

      return res.status(201).json(session);
    } catch (err) {
      console.error("Failed to book session:", err);
      return res.status(500).json({ error: "Failed to book session" });
    }
  },
);

// GET MY SESSIONS. A CLIENT SEES THEIR OWN, A THERAPIST SEES THEIR OWN, AN ADMIN SEES ALL.
// THE NEWEST COME FIRST AND EACH SESSION INCLUDES THE NAMES OF BOTH PEOPLE
router.get("/", authenticate, async (req: AuthRequest, res) => {
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
});

// CHANGE THE STATUS OF A SESSION.
// THE THERAPIST CAN CONFIRM, REJECT OR CANCEL. THE CLIENT CAN ONLY CANCEL THEIR OWN.
// WHEN A SESSION IS REJECTED OR CANCELLED, ITS SLOT BECOMES AVAILABLE AGAIN
router.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  const { status } = req.body;

  if (!NEW_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${NEW_STATUSES.join(", ")}`,
    });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id as string },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { id: userId, role } = req.user!;
    const isAdmin = role === "admin";
    const isTherapistOwner = session.therapistId === userId;
    const isPatientOwner = session.patientId === userId;

    if (!isAdmin && !isTherapistOwner && !isPatientOwner) {
      return res.status(403).json({ error: "Forbidden" });
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
});

export default router;
