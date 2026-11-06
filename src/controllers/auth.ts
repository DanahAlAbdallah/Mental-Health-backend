import type { Request, Response } from "express";
import bcrypt from "bcrypt"; // USE "bcryptjs" IF THAT IS WHAT YOU HAVE INSTALLED
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { JWT_SECRET } from "../config/env";

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
import {
  isSignupRole,
  isValidEmail,
  validatePassword,
} from "../validators/auth";
import { generatePasswordResetToken,hashToken } from "../lib/tokens";
// PRISMA ERRORS HAVE A `code`. P2002 = UNIQUE CONSTRAINT FAILED (EMAIL ALREADY EXISTS).
// CHECKING THE CODE DIRECTLY WORKS IN EVERY PRISMA VERSION.
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

// SIGNUP FUNCTION
export async function signup(req: Request, res: Response) {
  const { name, email, password, role } = req.body ?? {};

  // 1. EVERYTHING MUST BE A STRING BEFORE WE USE IT
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  // 2. SAME EMAIL = SAME ACCOUNT: " Ali@Mail.com " BECOMES "ali@mail.com"
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Email is not valid" });
  }

  // 3. ROLE MUST BE ON OUR WHITELIST, SO NOBODY CAN CHOOSE "admin"
  if (!isSignupRole(role)) {
    return res.status(400).json({ error: "Role must be client or therapist" });
  }

  // 4. PASSWORD RULES
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. NO findUnique FIRST. THE DATABASE'S UNIQUE RULE DECIDES, SO TWO
    //    REQUESTS AT THE SAME TIME CAN'T BOTH SUCCEED.
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role, // SAFE: TYPESCRIPT KNOWS IT IS "client" | "therapist"
      },
    });

    // 6. PIN THE ALGORITHM
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
      algorithm: "HS256",
    });

    // 7. BUILD THE RESPONSE BY HAND, SO THE PASSWORD HASH IS NEVER SENT
    return res.status(201).json({
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
    if (isUniqueConstraintError(err)) {
      return res.status(400).json({ error: "Email already registered" });
    }
    console.error("Signup failed:", err);
    return res.status(500).json({ error: "Failed to create account" });
  }
}

// LOGIN FUNCTION
export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  // 1. BOTH MUST BE STRINGS (AN OBJECT OR NUMBER WOULD MAKE bcrypt THROW A 500)
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // 2. SAME NORMALIZATION AS SIGNUP, OTHERWISE "Ali@Mail.com" CAN'T LOG IN
  const normalizedEmail = email.trim().toLowerCase();

  // 3. SIGNUP NEVER ALLOWS PASSWORDS OVER 72, SO REJECT ABSURD INPUT EARLY
  if (password.length > 72) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 4. ALWAYS RUN bcrypt.compare, EVEN IF THE USER DOESN'T EXIST,
    //    SO BOTH CASES TAKE ABOUT THE SAME TIME
    const validPassword = await bcrypt.compare(
      password,
      (user ? user.password : DUMMY_HASH) as string,
    );

    // 5. SAME GENERIC MESSAGE FOR "NO USER" AND "WRONG PASSWORD"
    if (!user || !validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 6. PIN THE ALGORITHM
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
      algorithm: "HS256",
    });

    // 7. BUILD THE RESPONSE BY HAND, SO THE PASSWORD HASH IS NEVER SENT
    return res.json({
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
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res
      .status(500)
      .json({ error: "An unexpected error occurred during login" });
  }
}

// FORGET PASSWORD
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // ANTI-ENUMERATION GUARD:
    // Always return a neutral success message whether the email exists or not.
    const genericResponse = {
      message: "If that email exists in our system, we have sent a password reset link.",
    };

    const user = await prisma.user.findUnique({ where: { email } });

    // If user doesn't exist, or is a Google-only account (has no password set), 
    // silently stop here but return the exact same success response.
    if (!user || !user.password) {
      return res.status(200).json(genericResponse);
    }

    // Invalidate any older unused reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate fresh token and hash
    const { rawToken, tokenHash } = generatePasswordResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // Valid for 30 minutes

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Construct reset link pointing to your frontend
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    // TODO: Send email via Resend API
    // For local dev right now, print it to the console:
    console.log(`[DEV ONLY] Password reset link for ${email}: ${resetLink}`);

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// RESET PASSWORD 
export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and new password are required" });
  }

  // Validate password strength rules (reuse your signup validation rules)
  // const validationError = validatePassword(newPassword);
  // if (validationError) return res.status(400).json({ error: validationError });

  try {
    const tokenHash = hashToken(token);

    // Find the token record in the database
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // Check if token exists, has already been used, or has expired
    if (
      !resetRecord ||
      resetRecord.usedAt !== null ||
      resetRecord.expiresAt < new Date()
    ) {
      return res.status(400).json({ error: "Invalid or expired password reset token" });
    }

    // Hash the new password securely
    const saltRounds = 12; // High work factor for secure hashing
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Perform atomic update: update password, record passwordChangedAt timestamp, mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(), // Invalidates all previous JWTs instantly
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.status(200).json({ message: "Password has been successfully reset. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
