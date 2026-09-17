import { Router } from "express";

import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "../middleware/auth";
import { PrismaClient } from "../../generated/prisma";

const router = Router();
const prisma = new PrismaClient();

// GET all articles
router.get("/", async (req, res) => {
  const articles = await prisma.article.findMany();
  res.json(articles);
});

// GET single article
router.get("/:id", async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id as string },
  });
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }
  res.json(article);
});

// CREATE article
router.post(
  "/",
  authenticate,
  requireRole("therapist", "admin"),
  async (req: AuthRequest, res) => {
    const { title, content, category } = req.body;
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id as string },
    });
    const article = await prisma.article.create({
      data: { title, content, author: currentUser!.name, category },
    });
    res.status(201).json(article);
  },
);

// UPDATE article
router.put(
  "/:id",
  authenticate,
  requireRole("therapist", "admin"),
  async (req, res) => {
    const { title, content, author, category } = req.body;
    const article = await prisma.article.update({
      where: { id: req.params.id as string },
      data: { title, content, author, category },
    });
    res.json(article);
  },
);

// DELETE article
router.delete(
  "/:id",
  authenticate,
  requireRole("therapist", "admin"),
  async (req, res) => {
    await prisma.article.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  },
);

export default router;
