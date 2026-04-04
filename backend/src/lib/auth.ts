import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { pool } from "../db";

const isProduction = process.env.BETTER_AUTH_URL?.startsWith("https://");

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    },
  },
  plugins: [
    organization(),
  ],
});
