import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET ALL USERS
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(users);
});

// GET SINGLE USER
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  const isOwnProfile = req.user!.id === req.params.id;
  const isAdmin = req.user!.role === "admin";

  if (!isOwnProfile && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id as string },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

// UPDATE USER
router.put("/:id", authenticate, async (req: AuthRequest, res) => {
  const isOwnProfile = req.user!.id === req.params.id;
  const isAdmin = req.user!.role === "admin";

  if (!isOwnProfile && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, email } = req.body;

  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { name, email },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(user);
});

// DELETE USER
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
});

export default router;
