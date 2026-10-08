"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../generated/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
const today = new Date().toISOString().split("T")[0];
// CREATE AVAILABILITY SLOT — therapist only, for their own account
router.post("/", auth_1.authenticate, (0, auth_1.requireRole)("therapist"), async (req, res) => {
    const { date, startTime, endTime } = req.body;
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
        return res.status(400).json({ error: "Cannot create a slot in the past" });
    }
    const existing = await prisma.availabilitySlot.findFirst({
        where: { therapistId: req.user.id, date, startTime },
    });
    if (existing) {
        return res.status(400).json({ error: "You already have a slot at this time" });
    }
    const slot = await prisma.availabilitySlot.create({
        data: { therapistId: req.user.id, date, startTime, endTime },
    });
    res.status(201).json(slot);
});
// GET OPEN SLOTS FOR A THERAPIST — public, no login required
router.get("/:therapistId", async (req, res) => {
    const slots = await prisma.availabilitySlot.findMany({
        where: {
            therapistId: req.params.therapistId,
            isBooked: false,
        },
    });
    res.json(slots);
});
// DELETE AVAILABILITY SLOT — therapist can only delete their own, and only if not booked
router.delete("/:id", auth_1.authenticate, (0, auth_1.requireRole)("therapist"), async (req, res) => {
    const slot = await prisma.availabilitySlot.findUnique({
        where: { id: req.params.id },
    });
    if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
    }
    if (slot.therapistId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }
    if (slot.isBooked) {
        return res.status(400).json({ error: "Cannot delete a booked slot" });
    }
    await prisma.availabilitySlot.delete({
        where: { id: req.params.id },
    });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=availability.js.map