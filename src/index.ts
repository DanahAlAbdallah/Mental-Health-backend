import express from "express";
import cors from "cors";
import { PrismaClient } from "../generated/prisma";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get("/api/articles", async (req, res) => {
  const articles = await prisma.article.findMany();
  res.json(articles);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// GET SINGLE ARTICLE
app.get("/api/articles/:id", async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
  });
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }
  res.json(article);
});

// CREATE ARTICLE
app.post("/api/articles", async (req, res) => {
  const { title, content, author, category } = req.body;
  const article = await prisma.article.create({
    data: { title, content, author, category },
  });
  res.status(201).json(article);
});

// UPDATE ARTICLE
app.put("/api/articles/:id", async (req, res) => {
  const { title, content, author, category } = req.body;
  const article = await prisma.article.update({
    where: { id: req.params.id },
    data: { title, content, author, category },
  });
  res.json(article);
});

// DELETE ARTICLE
app.delete("/api/articles/:id", async (req, res) => {
  await prisma.article.delete({
    where: { id: req.params.id },
  });
  res.status(204).send();
});
