import { Router } from "express";

import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "../middleware/auth";
import { PrismaClient } from "../../generated/prisma";

const router = Router();
const prisma = new PrismaClient();

// GET all articles (with optional case-insensitive search)
router.get("/", async (req, res) => {
  const search = (req.query.search as string | undefined)?.trim();

  try {
    const articles = await prisma.article.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { content: { contains: search, mode: "insensitive" } },
              { category: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
    });

    res.json(articles);
  } catch (err) {
    console.error("Failed to fetch articles:", err);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// GET latest 3 articles

router.get("/latest", async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    });

    res.json(articles);
  } catch (error) {
    console.error("Error fetching latest articles:", error);
    res.status(500).json({ error: "Failed to fetch latest articles" });
  }
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

// CREATE ARTICLE
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

// UPDATE ARTICLE
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

// DELETE ARTICLE
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
