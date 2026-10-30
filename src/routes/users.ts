import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import * as users from "../controllers/users";

const router = Router();

// PUBLIC
router.get("/therapists", users.listTherapists);
router.get("/therapists/:id", users.getTherapist);

// LOGGED-IN THERAPIST
router.get("/me/profile", authenticate, requireRole("therapist"), users.getMyProfile);
router.put("/me/profile", authenticate, requireRole("therapist"), users.saveMyProfile);

// ANY LOGGED-IN USER
router.put("/me", authenticate, users.updateMe);

// ADMIN ONLY
router.get("/", authenticate, requireRole("admin"), users.listUsers);
router.delete("/:id", authenticate, requireRole("admin"), users.deleteUser);

// OWNER OR ADMIN (THE CHECK HAPPENS INSIDE THE CONTROLLER)
router.get("/:id", authenticate, users.getUser);

export default router;