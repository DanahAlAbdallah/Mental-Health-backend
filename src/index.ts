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
