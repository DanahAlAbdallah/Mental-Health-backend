import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

// THE SECRET USED TO SIGN AND CHECK LOGIN TOKENS.
// IF IT IS MISSING WE STOP THE SERVER AT STARTUP, INSTEAD OF REJECTING EVERY LOGIN LATER
const JWT_SECRET = process.env.JWT_SECRET;
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
export function authenticate(
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
    const decoded = jwt.verify(token, JWT_SECRET!) as unknown as {
      id: string;
      role: string;
    };
    req.user = decoded;
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
