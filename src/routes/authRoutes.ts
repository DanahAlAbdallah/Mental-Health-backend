import { Router } from "express";
import {
  forgotPassword,
  login,
  resetPassword,
  signup,
  verifyEmail
} from "../controllers/auth";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);

//RESET PASSWORD
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ACCOUNT VERIFICATION
router.post("/verify-email", verifyEmail);

export default router;
