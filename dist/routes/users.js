"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../generated/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
// GET ALL USERS
router.get("/", auth_1.authenticate, (0, auth_1.requireRole)("admin"), async (req, res) => {
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
    });
    res.json(users);
});
// GET ALL THERAPISTS ONLY
router.get("/therapists", async (req, res) => {
    const therapists = await prisma.user.findMany({
        where: { role: "therapist" },
        select: { id: true, name: true },
    });
    res.json(therapists);
});
// GET SINGLE USER
router.get("/:id", auth_1.authenticate, async (req, res) => {
    const isOwnProfile = req.user.id === req.params.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwnProfile && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
    }
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
});
// UPDATE USER
router.put("/:id", auth_1.authenticate, async (req, res) => {
    const isOwnProfile = req.user.id === req.params.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwnProfile && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
    }
    const { name, email } = req.body;
    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { name, email },
        select: { id: true, name: true, email: true, role: true },
    });
    res.json(user);
});
// DELETE USER
router.delete("/:id", auth_1.authenticate, (0, auth_1.requireRole)("admin"), async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=users.js.map