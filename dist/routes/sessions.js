"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../generated/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
// BOOK A SESSION — CLIENT ONLY BOOKS AN OPEN SLOT
router.post("/", auth_1.authenticate, (0, auth_1.requireRole)("client"), async (req, res) => {
    const { slotId } = req.body;
    const slot = await prisma.availabilitySlot.findUnique({
        where: { id: slotId },
    });
    if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
    }
    if (slot.isBooked) {
        return res.status(400).json({ error: "Slot is already booked" });
    }
    const [session] = await prisma.$transaction([
        prisma.session.create({
            data: {
                therapistId: slot.therapistId,
                patientId: req.user.id,
                slotId: slot.id,
                date: slot.date,
                startTime: slot.startTime,
                endTime: slot.endTime,
                status: "pending",
            },
        }),
        prisma.availabilitySlot.update({
            where: { id: slot.id },
            data: { isBooked: true },
        }),
    ]);
    res.status(201).json(session);
});
// GET MY SESSIONS — CLIENT SEES THEIR OWN< THERAPIST SEES THEIR OWN AND ADMIN SEES ALL
router.get("/", auth_1.authenticate, async (req, res) => {
    const { role, id } = req.user;
    const where = role === "admin"
        ? {}
        : role === "therapist"
            ? { therapistId: id }
            : { patientId: id };
    const sessions = await prisma.session.findMany({ where });
    res.json(sessions);
});
// UPDATE SESSION STATUS — therapist confirms/cancels their own sessions, or admin
router.patch("/:id", auth_1.authenticate, async (req, res) => {
    const { status } = req.body;
    const session = await prisma.session.findUnique({
        where: { id: req.params.id },
    });
    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }
    const isOwnSession = session.therapistId === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwnSession && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
    }
    const updated = await prisma.session.update({
        where: { id: req.params.id },
        data: { status },
    });
    if (status === "cancelled") {
        await prisma.availabilitySlot.update({
            where: { id: session.slotId },
            data: { isBooked: false },
        });
    }
    res.json(updated);
});
exports.default = router;
//# sourceMappingURL=sessions.js.map