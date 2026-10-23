import { Router } from "express";
import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "../middleware/auth";
import { PrismaClient } from "../../generated/prisma";

const router = Router();
const prisma = new PrismaClient();

// GET ALL ARTICLES, WITH AN OPTIONAL SEARCH THAT IGNORES UPPERCASE AND LOWERCASE
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

// GET SPECIFIC THERAPIST ARTICLES
router.get("/mine", authenticate, async (req: AuthRequest, res) => {
  if (req.user!.role !== "therapist") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const articles = await prisma.article.findMany({
      where: { authorId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(articles);
  } catch (err) {
    console.error("Failed to fetch my articles:", err);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// GET THE 3 NEWEST ARTICLES (FOR THE LANDING PAGE).
// MUST STAY ABOVE "/:id", OTHERWISE "latest" IS TREATED AS AN ID
router.get("/latest", async (_req, res) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    res.json(articles);
  } catch (err) {
    console.error("Failed to fetch latest articles:", err);
    res.status(500).json({ error: "Failed to fetch latest articles" });
  }
});

// GET ONE ARTICLE BY ID
router.get("/:id", async (req, res) => {
  try {
    const article = await prisma.article.findUnique({
      where: { id: req.params.id as string },
    });

    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    res.json(article);
  } catch (err) {
    console.error("Failed to fetch article:", err);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// CREATE AN ARTICLE. THE AUTHOR COMES FROM THE LOGIN TOKEN, NEVER FROM THE REQUEST
router.post(
  "/",
  authenticate,
  requireRole("therapist", "admin"),
  async (req: AuthRequest, res) => {
    const { title, content, category } = req.body;

    if (!title?.trim() || !content?.trim() || !category?.trim()) {
      return res
        .status(400)
        .json({ error: "Title, content and category are required" });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const article = await prisma.article.create({
        data: {
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
          author: user.name,
          authorId: user.id,
        },
      });

      res.status(201).json(article);
    } catch (err) {
      console.error("Failed to create article:", err);
      res.status(500).json({ error: "Failed to create article" });
    }
  },
);

// UPDATE AN ARTICLE. ONLY ITS OWNER (OR AN ADMIN) CAN DO IT,
// AND THE AUTHOR CAN NEVER BE CHANGED
router.put(
  "/:id",
  authenticate,
  requireRole("therapist", "admin"),
  async (req: AuthRequest, res) => {
    const { title, content, category } = req.body;

    if (!title?.trim() || !content?.trim() || !category?.trim()) {
      return res
        .status(400)
        .json({ error: "Title, content and category are required" });
    }

    try {
      const article = await prisma.article.findUnique({
        where: { id: req.params.id as string },
      });

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      if (article.authorId !== req.user!.id && req.user!.role !== "admin") {
        return res
          .status(403)
          .json({ error: "You can only edit your own articles" });
      }

      const updated = await prisma.article.update({
        where: { id: article.id },
        data: {
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
        },
      });

      res.json(updated);
    } catch (err) {
      console.error("Failed to update article:", err);
      res.status(500).json({ error: "Failed to update article" });
    }
  },
);

// DELETE AN ARTICLE. ONLY ITS OWNER (OR AN ADMIN) CAN DO IT
router.delete(
  "/:id",
  authenticate,
  requireRole("therapist", "admin"),
  async (req: AuthRequest, res) => {
    try {
      const article = await prisma.article.findUnique({
        where: { id: req.params.id as string },
      });

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      if (article.authorId !== req.user!.id && req.user!.role !== "admin") {
        return res
          .status(403)
          .json({ error: "You can only delete your own articles" });
      }

      await prisma.article.delete({ where: { id: article.id } });
      res.status(204).send();
    } catch (err) {
      console.error("Failed to delete article:", err);
      res.status(500).json({ error: "Failed to delete article" });
    }
  },
);

export default router;
