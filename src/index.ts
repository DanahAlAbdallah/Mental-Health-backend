import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import articlesRouter from "./routes/articles";
import usersRouter from "./routes/users";
import availabilityRouter from "./routes/availability";
import sessionsRouter from "./routes/sessions";
import { PrismaClient } from "../generated/prisma";

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;

app.use(cors());
app.use(express.json());

// ARTICLE ROUTES
app.use("/api/articles", articlesRouter);

// USERS ROUTES
app.use("/api/users", usersRouter);

// THERAPIST AVAILABILITY SLOTS ROUTES
app.use("/api/availability", availabilityRouter);

// SESSEIONS ROUTES
app.use("/api/sessions", sessionsRouter);

// ================= LOGIN  =================

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

// ================= SIGNUP  =================
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
