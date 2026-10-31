import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import * as sessions from "../controllers/sessions";

const router = Router();

router.post("/", authenticate, requireRole("client"), sessions.bookSession);
router.get("/", authenticate, sessions.listMySessions);
router.patch("/:id", authenticate, sessions.updateSessionStatus);

export default router;
