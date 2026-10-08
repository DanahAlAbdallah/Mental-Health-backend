"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../../generated/prisma");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
// GET all articles
router.get("/", async (req, res) => {
    const { search } = req.query;
    const articles = await prisma.article.findMany({
        where: search
            ? {
                OR: [
                    { title: { contains: search } },
                    { content: { contains: search } },
                    { category: { contains: search } },
                ],
            }
            : {},
    });
    res.json(articles);
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
    }
    catch (error) {
        console.error("Error fetching latest articles:", error);
        res.status(500).json({ error: "Failed to fetch latest articles" });
    }
});
// GET single article
router.get("/:id", async (req, res) => {
    const article = await prisma.article.findUnique({
        where: { id: req.params.id },
    });
    if (!article) {
        return res.status(404).json({ error: "Article not found" });
    }
    res.json(article);
});
// CREATE article
router.post("/", auth_1.authenticate, (0, auth_1.requireRole)("therapist", "admin"), async (req, res) => {
    const { title, content, category } = req.body;
    const currentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
    });
    const article = await prisma.article.create({
        data: { title, content, author: currentUser.name, category },
    });
    res.status(201).json(article);
});
// UPDATE article
router.put("/:id", auth_1.authenticate, (0, auth_1.requireRole)("therapist", "admin"), async (req, res) => {
    const { title, content, author, category } = req.body;
    const article = await prisma.article.update({
        where: { id: req.params.id },
        data: { title, content, author, category },
    });
    res.json(article);
});
// DELETE article
router.delete("/:id", auth_1.authenticate, (0, auth_1.requireRole)("therapist", "admin"), async (req, res) => {
    await prisma.article.delete({ where: { id: req.params.id } });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=articles.js.map