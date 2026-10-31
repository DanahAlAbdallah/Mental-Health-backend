import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import {
  MAX_ARTICLES_PER_AUTHOR,
  MAX_SEARCH_LENGTH,
  parsePositiveInt,
  validateArticleInput,
} from "../validators/articles";

// ALL ARTICLES, WITH AN OPTIONAL SEARCH THAT IGNORES UPPERCASE AND LOWERCASE.
// RETURNS AT MOST 50 AT A TIME (?limit=20&page=2 TO CHANGE IT, MAX 100 PER PAGE)
export async function listArticles(req: Request, res: Response) {
  const rawSearch = req.query.search;

  // THE URL VALUE CAN BE A LIST (?search=a&search=b), SO CHECK IT IS TEXT
  if (rawSearch !== undefined && typeof rawSearch !== "string") {
    return res.status(400).json({ error: "Search must be text" });
  }
  const search = rawSearch?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;

  const limit = parsePositiveInt(req.query.limit, 50, 100);
  const page = parsePositiveInt(req.query.page, 1, 10000);

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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: (page - 1) * limit,
    });

    res.json(articles);
  } catch (err) {
    console.error("Failed to fetch articles:", err);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
}

// THE LOGGED IN THERAPIST'S OWN ARTICLES
export async function listMyArticles(req: AuthRequest, res: Response) {
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
}

// THE 3 NEWEST ARTICLES (FOR THE LANDING PAGE)
export async function listLatestArticles(_req: Request, res: Response) {
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
}

export async function getArticle(req: Request, res: Response) {
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
}

// THE AUTHOR COMES FROM THE LOGIN TOKEN, NEVER FROM THE REQUEST
export async function createArticle(req: AuthRequest, res: Response) {
  const body = req.body ?? {};

  const error = validateArticleInput(body);
  if (error) return res.status(400).json({ error });

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // STOPS ONE ACCOUNT FROM FILLING THE DATABASE
    const count = await prisma.article.count({ where: { authorId: user.id } });
    if (count >= MAX_ARTICLES_PER_AUTHOR) {
      return res.status(409).json({
        error: `You can have at most ${MAX_ARTICLES_PER_AUTHOR} articles. Delete some first.`,
      });
    }

    const article = await prisma.article.create({
      data: {
        title: body.title.trim(),
        content: body.content.trim(),
        category: body.category.trim(),
        author: user.name,
        authorId: user.id,
      },
    });

    res.status(201).json(article);
  } catch (err) {
    console.error("Failed to create article:", err);
    res.status(500).json({ error: "Failed to create article" });
  }
}

// ONLY THE OWNER (OR AN ADMIN) CAN UPDATE, AND THE AUTHOR CAN NEVER BE CHANGED
export async function updateArticle(req: AuthRequest, res: Response) {
  const body = req.body ?? {};

  const error = validateArticleInput(body);
  if (error) return res.status(400).json({ error });

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
        title: body.title.trim(),
        content: body.content.trim(),
        category: body.category.trim(),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Failed to update article:", err);
    res.status(500).json({ error: "Failed to update article" });
  }
}

// ONLY THE OWNER (OR AN ADMIN) CAN DELETE
export async function deleteArticle(req: AuthRequest, res: Response) {
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
}
