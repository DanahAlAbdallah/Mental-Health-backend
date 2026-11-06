import crypto from "crypto";

// Generates a random raw token for the email link and its secure hash for the DB
export function generatePasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  
  return { rawToken, tokenHash };
}

// Hashes an incoming token from the frontend to check against the DB
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}