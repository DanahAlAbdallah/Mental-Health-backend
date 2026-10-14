import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();


 // BOOK A SESSION — CLIENT ONLY
router.post(
  "/",
  authenticate,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    const { slotId } = req.body;

    if (typeof slotId !== "string" || !slotId.trim()) {
      return res.status(400).json({ error: "A valid slotId is required" });
    }

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
        where: {
          id: slotId,
          isBooked: false,
        },
        data: {
          isBooked: true,
        },
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
        error: "This slot is no longer available. Please choose another time.",
      });
    }

    return res.status(201).json(session);
  },
);


// GET MY SESSIONS — CLIENT SEES THEIR OWN< THERAPIST SEES THEIR OWN AND ADMIN SEES ALL
router.get("/", authenticate, async (req: AuthRequest, res) => {
  const { role, id } = req.user!;

  const where =
    role === "admin"
      ? {}
      : role === "therapist"
        ? { therapistId: id }
        : { patientId: id };

  const sessions = await prisma.session.findMany({ where });
  res.json(sessions);
});

// UPDATE SESSION STATUS — therapist confirms/cancels their own sessions, or admin
router.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  const { status } = req.body;

  const session = await prisma.session.findUnique({
    where: { id: req.params.id as string },
  });

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const isOwnSession = session.therapistId === req.user!.id;
  const isAdmin = req.user!.role === "admin";

  if (!isOwnSession && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updated = await prisma.session.update({
    where: { id: req.params.id as string },
    data: { status },
  });

  if (status === "cancelled") {
    await prisma.availabilitySlot.update({
      where: { id: session.slotId },
      data: { isBooked: false },
    });
  }

  res.json(updated);
});

export default router;
