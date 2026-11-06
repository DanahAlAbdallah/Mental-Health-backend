import { Router } from "express";
import { forgotPassword, login, resetPassword, signup } from "../controllers/auth";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);

// New password reset routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
