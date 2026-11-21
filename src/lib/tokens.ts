import crypto from "crypto";

// Generates a secure random token and its SHA-256 hash.
export function generateToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  return { rawToken, tokenHash };
}

// Hashes an incoming token to compare it with the database.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
