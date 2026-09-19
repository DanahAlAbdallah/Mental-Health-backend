import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// CREATE AVAILABILITY SLOT — therapist only, for their own account
router.post(
  "/",
  authenticate,
  requireRole("therapist"),
  async (req: AuthRequest, res) => {
    const { date, startTime, endTime } = req.body;

    const slot = await prisma.availabilitySlot.create({
      data: {
        therapistId: req.user!.id,
        date,
        startTime,
        endTime,
      },
    });

    res.status(201).json(slot);
  }
);

// GET OPEN SLOTS FOR A THERAPIST — public, no login required
router.get("/:therapistId", async (req, res) => {
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      therapistId: req.params.therapistId as string,
      isBooked: false,
    },
  });
  res.json(slots);
});

// DELETE AVAILABILITY SLOT — therapist can only delete their own, and only if not booked
router.delete(
  "/:id",
  authenticate,
  requireRole("therapist"),
  async (req: AuthRequest, res) => {
    const slot = await prisma.availabilitySlot.findUnique({
      where: { id: req.params.id as string },
    });

    if (!slot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    if (slot.therapistId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (slot.isBooked) {
      return res.status(400).json({ error: "Cannot delete a booked slot" });
    }

    await prisma.availabilitySlot.delete({
      where: { id: req.params.id as string },
    });

    res.status(204).send();
  }
);

export default router;