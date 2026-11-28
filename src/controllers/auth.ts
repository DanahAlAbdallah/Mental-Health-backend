import type { Request, Response } from "express";
import bcrypt from "bcrypt"; // USE "bcryptjs" IF THAT IS WHAT YOU HAVE INSTALLED
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { JWT_SECRET } from "../config/env";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/mail";
import {
  isSignupRole,
  isValidEmail,
  validatePassword,
} from "../validators/auth";
import { generateToken, hashToken } from "../lib/tokens";

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
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
const { name, email, password, role, returnTo } = req.body ?? {};
const safeReturnTo = returnTo === "/therapists" ? "/therapists" : "/";
  // 1. Validate name
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return res.status(400).json({ error: "Name is required" });
  }

  // 2. Validate email
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Email is not valid" });
  }

  // 3. Validate role
  if (!isSignupRole(role)) {
    return res.status(400).json({
      error: "Role must be client or therapist",
    });
  }

  // 4. Validate password
  const passwordError = validatePassword(password);

  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Generate a verification token
    const { rawToken, tokenHash } = generateToken();

    // 6. Create the user and verification token together
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role,
          // emailVerified defaults to false
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: newUser.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return newUser;
    });

    // 7. Send the verification email
    try {
   await sendVerificationEmail(user.email, rawToken, safeReturnTo);
    } catch (emailError) {
      console.error("Verification email delivery failed:", emailError);

      // Account exists, but email delivery failed.
      // We will implement a resend endpoint later.
      return res.status(503).json({
        error:
          "Account created, but verification email could not be sent. Please try again later.",
      });
    }

    // 8. Do NOT issue a JWT yet.
    // The user must verify their email first.
    return res.status(201).json({
      message:
        "Account created successfully. Please check your email to verify your account.",
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(400).json({
        error: "Email already registered",
      });
    }

    console.error("Signup failed:", err);

    return res.status(500).json({
      error: "Failed to create account",
    });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body ?? {};

  // 1. Validate token
  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({
      error: "Verification token is required",
    });
  }

  try {
    // 2. Hash the incoming token
    const tokenHash = hashToken(token.trim());

    // 3. Find the matching token
    const verificationRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    // 4. Reject invalid tokens
    if (!verificationRecord) {
      return res.status(400).json({
        error: "Invalid or expired verification link",
      });
    }

    const now = new Date();

    // 5. Reject expired or previously used tokens
    if (verificationRecord.usedAt || verificationRecord.expiresAt <= now) {
      return res.status(400).json({
        error: "Invalid or expired verification link",
      });
    }

    // 6. Atomically consume the token and verify the account
    const result = await prisma.$transaction(async (tx) => {
      const consumedToken = await tx.emailVerificationToken.updateMany({
        where: {
          id: verificationRecord.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      // Another request may already have consumed it
      if (consumedToken.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: { id: verificationRecord.userId },
        data: { emailVerified: true },
      });

      return true;
    });

    if (!result) {
      return res.status(400).json({
        error: "Invalid or expired verification link",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: verificationRecord.userId },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

 const authToken = jwt.sign(
  { id: user.id, role: user.role },
  JWT_SECRET,
  {
    expiresIn: "7d",
    algorithm: "HS256",
  },
);
    // 7. Success
  return res.status(200).json({
  message: "Email verified successfully.",
  token: authToken,
  user: {
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  },
});
  } catch (error) {
    console.error("EMAIL VERIFICATION ERROR:", error);

    return res.status(500).json({
      error: "An unexpected error occurred during email verification",
    });
  }
}

// LOGIN FUNCTION

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  // 1. Validate input types
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 2. Reject passwords that exceed bcrypt's limit
  if (password.length > 72) {
    return res.status(401).json({
      error: "Invalid email or password",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 3. Always compare passwords, even if the user doesn't exist
    // Use DUMMY_HASH if the user has no password (e.g. Google-only account)
    const passwordHash = user?.password ?? DUMMY_HASH;

    const validPassword = await bcrypt.compare(password, passwordHash);

    // 4. Generic error for invalid credentials
    if (!user || !user.password || !validPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // 5. Require email verification before issuing a JWT
    if (!user.emailVerified) {
      return res.status(403).json({
        error: "Please verify your email before logging in.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // 6. Only verified users receive a JWT
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
      algorithm: "HS256",
    });

    // 7. Return safe user information
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      error: "An unexpected error occurred during login",
    });
  }
}

// FORGET PASSWORD
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    // 1. Find the user (use anti-enumeration: always return success message even if not found)
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // 2. Generate the reset token
      const { rawToken, tokenHash } = generateToken();

      // 3. Set expiration to 30 minutes from now
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // 4. Save the hashed token to the database
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash,
          expiresAt,
        },
      });

      // 5. Send the real email via Resend
      try {
        await sendPasswordResetEmail(email, rawToken);
      } catch (emailError) {
        console.error("Error dispatching password reset email:", emailError);
      }
    }

    // Always return a neutral response to prevent user enumeration
    return res.status(200).json({
      message:
        "If that email exists in our system, we have sent a password reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
// RESET PASSWORD
export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body;

  if (
    typeof token !== "string" ||
    !token.trim() ||
    typeof newPassword !== "string" ||
    !newPassword
  ) {
    return res.status(400).json({
      error: "Token and new password are required",
    });
  }

  const validationError = validatePassword(newPassword);

  if (validationError) {
    return res.status(400).json({
      error: validationError,
    });
  }

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
      return res
        .status(400)
        .json({ error: "Invalid or expired password reset token" });
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

    return res.status(200).json({
      message: "Password has been successfully reset. You can now log in.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
