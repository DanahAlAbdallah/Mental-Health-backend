
import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import * as users from "../controllers/users";

const router = Router();

// PUBLIC
router.get("/therapists", users.listTherapists);
router.get("/therapists/:id", users.getTherapist);

// ANY LOGGED-IN USER
// Keep /me before /:id
router.get("/me", authenticate, users.getMyAccount);
router.put("/me", authenticate, users.updateMe);

// LOGGED-IN THERAPIST
router.get(
  "/me/profile",
  authenticate,
  requireRole("therapist"),
  users.getMyProfile
);

router.put(
  "/me/profile",
  authenticate,
  requireRole("therapist"),
  users.saveMyProfile
);

// ADMIN ONLY
router.get(
  "/",
  authenticate,
  requireRole("admin"),
  users.listUsers
);

router.get(
  "/admin/:id",
  authenticate,
  requireRole("admin"),
  users.getAdminUser
);

router.delete(
  "/:id",
  authenticate,
  requireRole("admin"),
  users.deleteUser
);

// PUBLIC THERAPIST PROFILE ONLY
router.get("/:id", users.getUserDetails);

export default router;
