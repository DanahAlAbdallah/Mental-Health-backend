"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const articles_1 = __importDefault(require("./routes/articles"));
const users_1 = __importDefault(require("./routes/users"));
const availability_1 = __importDefault(require("./routes/availability"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const prisma_1 = require("../generated/prisma");
const app = (0, express_1.default)();
const prisma = new prisma_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ARTICLE ROUTES
app.use("/api/articles", articles_1.default);
// USERS ROUTES
app.use("/api/users", users_1.default);
// THERAPIST AVAILABILITY SLOTS ROUTES
app.use("/api/availability", availability_1.default);
// SESSEIONS ROUTES
app.use("/api/sessions", sessions_1.default);
// ================= LOGIN  =================
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
    }
    const validPassword = await bcrypt_1.default.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: "7d",
    });
    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
});
// ================= SIGNUP  =================
app.post("/api/auth/signup", async (req, res) => {
    const { name, email, password, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(400).json({ error: "Email already registered" });
    }
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    const user = await prisma.user.create({
        data: { name, email, password: hashedPassword, role },
    });
    const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: "7d",
    });
    res.status(201).json({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    });
});
// ================= START SERVER =================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map