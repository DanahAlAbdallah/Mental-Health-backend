import express from "express";
import cors from "cors";
import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv/config";
import type { Request, Response, NextFunction } from "express";
import { authenticate, requireRole, type AuthRequest } from "./middleware/auth";
const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;

app.use(cors());
app.use(express.json());


// ================= ARTICLE ROUTES =================

app.get("/api/articles", async (req, res) => {
  const articles = await prisma.article.findMany();
  res.json(articles);
});

app.get("/api/articles/:id", async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
  });
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }
  res.json(article);
});

app.post(
  "/api/articles",
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
  }
);

app.put(
  "/api/articles/:id",
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

app.delete(
  "/api/articles/:id",
  authenticate,
  requireRole("therapist", "admin"),
  async (req, res) => {
    await prisma.article.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  },
);

// ================= AUTH ROUTES =================

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role },
  });

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// ================= START SERVER =================

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
