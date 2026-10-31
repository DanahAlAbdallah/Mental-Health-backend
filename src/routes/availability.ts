import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import * as availability from "../controllers/availability";

const router = Router();

router.post(
  "/",
  authenticate,
  requireRole("therapist"),
  availability.createSlot,
);

// MUST STAY ABOVE "/:therapistId", OTHERWISE "me" IS TREATED AS A THERAPIST ID
router.get(
  "/me",
  authenticate,
  requireRole("therapist"),
  availability.listMySlots,
);

// PUBLIC
router.get("/:therapistId", availability.listOpenSlots);

router.delete(
  "/:id",
  authenticate,
  requireRole("therapist"),
  availability.deleteSlot,
);

export default router;
