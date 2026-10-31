import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getNow } from "../lib/time";
import type { AuthRequest } from "../middleware/auth";
import { validateSlotInput } from "../validators/availability";

// A THERAPIST CANNOT HAVE MORE THAN THIS MANY UPCOMING SLOTS AT ONCE
const MAX_UPCOMING_SLOTS = 300;

// CREATE A SLOT (THERAPIST ONLY, ALWAYS FOR THEIR OWN ACCOUNT)
export async function createSlot(req: AuthRequest, res: Response) {
  const body = req.body ?? {};

  const error = validateSlotInput(body);
  if (error) return res.status(400).json({ error });

  const { date, startTime, endTime } = body;
  const therapistId = req.user!.id;

  try {
    const upcoming = await prisma.availabilitySlot.count({
      where: { therapistId, date: { gte: getNow().date } },
    });
    if (upcoming >= MAX_UPCOMING_SLOTS) {
      return res.status(409).json({
        error: `You can have at most ${MAX_UPCOMING_SLOTS} upcoming slots. Delete some first.`,
      });
    }

    // A SLOT OVERLAPS IF IT STARTS BEFORE THE OTHER ENDS AND ENDS AFTER THE OTHER STARTS
    const overlapping = await prisma.availabilitySlot.findFirst({
      where: {
        therapistId,
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
      data: { therapistId, date, startTime, endTime },
    });

    res.status(201).json(slot);
  } catch (err) {
    console.error("Failed to create slot:", err);
    res.status(500).json({ error: "Failed to create slot" });
  }
}

// ALL MY SLOTS, BOOKED OR NOT (THERAPIST ONLY, FOR THE "MY AVAILABILITY" PAGE)
export async function listMySlots(req: AuthRequest, res: Response) {
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
}

// THE OPEN SLOTS OF A THERAPIST (PUBLIC, NO LOGIN).
// ONLY SLOTS THAT ARE NOT BOOKED AND HAVE NOT STARTED YET, EARLIEST FIRST
export async function listOpenSlots(req: Request, res: Response) {
  const { date: today, time: nowTime } = getNow();

  try {
    const slots = await prisma.availabilitySlot.findMany({
      where: {
        therapistId: req.params.therapistId as string,
        isBooked: false,
        OR: [
          { date: { gt: today } },
          { date: today, startTime: { gt: nowTime } },
        ],
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    res.json(slots);
  } catch (err) {
    console.error("Failed to fetch slots:", err);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
}

// DELETE A SLOT (THERAPIST ONLY, ONLY THEIR OWN, ONLY IF NOT BOOKED)
export async function deleteSlot(req: AuthRequest, res: Response) {
  const id = req.params.id as string;
  const therapistId = req.user!.id;

  try {
    // ONE ATOMIC STEP: DELETE ONLY IF IT IS MINE AND STILL NOT BOOKED.
    // A BOOKING CAN'T SLIP IN BETWEEN A CHECK AND THE DELETE
    const result = await prisma.availabilitySlot.deleteMany({
      where: { id, therapistId, isBooked: false },
    });

    if (result.count === 1) {
      return res.status(204).send();
    }

    // NOTHING WAS DELETED: FIND OUT WHY, SO THE ANSWER IS CLEAR
    const slot = await prisma.availabilitySlot.findFirst({
      where: { id, therapistId },
    });

    // SAME ANSWER FOR "DOESN'T EXIST" AND "NOT YOURS", SO IDS CAN'T BE PROBED
    if (!slot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    return res.status(409).json({ error: "Cannot delete a booked slot" });
  } catch (err) {
    console.error("Failed to delete slot:", err);
    res.status(500).json({ error: "Failed to delete slot" });
  }
}
