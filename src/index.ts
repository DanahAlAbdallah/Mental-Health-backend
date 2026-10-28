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
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      error: "An unexpected error occurred during login",
    });
  }
});


// ================= SIGNUP  =================
function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") {
    return "Password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/[A-Za-z]/.test(password)) {
    return "Password must contain at least one letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character";
  }
  return null;
}

// SIGNUP
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password, role } = req.body;

  // BASIC INPUT CHECKS
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  // PASSWORD CHECK
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: name.trim(), email, password: hashedPassword, role },
    });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Signup failed:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// ================= START SERVER =================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
