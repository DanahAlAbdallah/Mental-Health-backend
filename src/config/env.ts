import "dotenv/config";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET is not set in the environment variables");
}

// EXPORTED AS A PLAIN `string`, SO NO `JWT_SECRET!` IS NEEDED ANYWHERE ELSE
export const JWT_SECRET: string = secret;
