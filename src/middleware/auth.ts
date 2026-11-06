import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { JWT_SECRET } from "../config/env";
import { prisma } from "../lib/prisma";
// THE SECRET USED TO SIGN AND CHECK LOGIN TOKENS.
// IF IT IS MISSING WE STOP THE SERVER AT STARTUP, INSTEAD OF REJECTING EVERY LOGIN LATER

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in the environment variables");
}

// A NORMAL EXPRESS REQUEST THAT ALSO CARRIES THE LOGGED IN USER (SET BY authenticate)
export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

// CHECKS THE TOKEN SENT IN THE "Authorization: Bearer ..." HEADER.
// IF IT IS VALID, SAVES THE USER'S ID AND ROLE IN req.user AND CONTINUES.
// IF NOT, ANSWERS 401
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // 1. Verify token signature and explicitly lock down the algorithm
    const decoded = jwt.verify(token, JWT_SECRET!, {
      algorithms: ["HS256"],
    }) as {
      id: string;
      role: string;
      iat: number;
    };

    // 2. Check if the user changed their password after this token was issued
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { passwordChangedAt: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    if (user.passwordChangedAt) {
      const tokenIssuedAtMs = decoded.iat * 1000;
      const passwordChangedAtMs = new Date(user.passwordChangedAt).getTime();

      if (tokenIssuedAtMs < passwordChangedAtMs) {
        return res.status(401).json({
          error: "Password has been changed. Please log in again.",
        });
      }
    }

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
// ALLOWS ONLY USERS WITH ONE OF THE GIVEN ROLES (EXAMPLE: requireRole("therapist")).
// MUST COME AFTER authenticate, BECAUSE IT READS req.user. OTHERWISE ANSWERS 403
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
