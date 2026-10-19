import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// THE FORMATS WE ACCEPT: DATE AS 2026-10-16 AND TIME AS 09:30 (24 HOURS)
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

// TODAY'S DATE AS 2026-10-16. IT IS CALCULATED EVERY TIME IT IS NEEDED,
// NOT ONCE WHEN THE SERVER STARTS, OTHERWISE IT WOULD GO OUT OF DATE
function getToday() {
  return new Date().toISOString().split("T")[0] as string;
}

// CREATE A SLOT (THERAPIST ONLY, ALWAYS FOR THEIR OWN ACCOUNT)
router.post(
  "/",
  authenticate,
  requireRole("therapist"),
  async (req: AuthRequest, res) => {
    const { date, startTime, endTime } = req.body;

    if (
      typeof date !== "string" ||
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      !DATE_FORMAT.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      !TIME_FORMAT.test(startTime) ||
      !TIME_FORMAT.test(endTime)
    ) {
      return res
        .status(400)
        .json({
          error: "Please send a valid date and valid start and end times",
        });
    }

    if (date < getToday()) {
      return res
        .status(400)
        .json({ error: "Cannot create a slot in the past" });
    }

    if (endTime <= startTime) {
      return res
        .status(400)
        .json({ error: "The end time must be after the start time" });
    }

    try {
      // A SLOT OVERLAPS IF IT STARTS BEFORE THE OTHER ENDS AND ENDS AFTER THE OTHER STARTS
      const overlapping = await prisma.availabilitySlot.findFirst({
        where: {
          therapistId: req.user!.id,
          date,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (overlapping) {
        return res.status(409).json({
          error: `This overlaps with your slot at ${overlapping.startTime} - ${overlapping.endTime}`,
        });
      }

      const slot = await prisma.availabilitySlot.create({
        data: { therapistId: req.user!.id, date, startTime, endTime },
      });

      res.status(201).json(slot);
    } catch (err) {
      console.error("Failed to create slot:", err);
      res.status(500).json({ error: "Failed to create slot" });
    }
  },
);

// GET ALL MY SLOTS, BOOKED OR NOT (THERAPIST ONLY, FOR THE "MY AVAILABILITY" PAGE).
// MUST STAY ABOVE "/:therapistId", OTHERWISE "me" IS TREATED AS A THERAPIST ID
router.get(
  "/me",
  authenticate,
  requireRole("therapist"),
  async (req: AuthRequest, res) => {
    try {
      const slots = await prisma.availabilitySlot.findMany({
        where: { therapistId: req.user!.id },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });

      res.json(slots);
    } catch (err) {
      console.error("Failed to fetch my slots:", err);
      res.status(500).json({ error: "Failed to fetch slots" });
    }
  },
);

// GET THE OPEN SLOTS OF A THERAPIST (PUBLIC, NO LOGIN).
// ONLY SLOTS THAT ARE NOT BOOKED AND NOT IN THE PAST, EARLIEST FIRST
router.get("/:therapistId", async (req, res) => {
  try {
    const slots = await prisma.availabilitySlot.findMany({
      where: {
        therapistId: req.params.therapistId as string,
        isBooked: false,
        date: { gte: getToday() },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    res.json(slots);
  } catch (err) {
    console.error("Failed to fetch slots:", err);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

// DELETE A SLOT (THERAPIST ONLY, ONLY THEIR OWN, ONLY IF NOT BOOKED)
router.delete(
  "/:id",
  authenticate,
  requireRole("therapist"),
  async (req: AuthRequest, res) => {
    try {
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
        return res.status(409).json({ error: "Cannot delete a booked slot" });
      }

      await prisma.availabilitySlot.delete({ where: { id: slot.id } });
      res.status(204).send();
    } catch (err) {
      console.error("Failed to delete slot:", err);
      res.status(500).json({ error: "Failed to delete slot" });
    }
  },
);

export default router;
