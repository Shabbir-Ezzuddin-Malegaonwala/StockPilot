import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/db/schema/auth.ts", "./src/db/schema/app.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
