import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./lib/auth";
import { productRoutes } from "./routes/products";
import { movementRoutes } from "./routes/movements";
import { aiRoutes } from "./routes/ai";
import { settingsRoutes } from "./routes/settings";

const app = new Elysia()
  .use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }))
  // BetterAuth handles all /api/auth/* routes
  .all("/api/auth/*", async ({ request }) => {
    return auth.handler(request);
  })
  .use(productRoutes)
  .use(movementRoutes)
  .use(aiRoutes)
  .use(settingsRoutes)
  .get("/health", () => ({ status: "ok" }))
  .onError(({ error, set }) => {
    const err = error instanceof Error ? error : new Error(String(error));
    Bun.write(Bun.stderr, `[error] ${err.message}\n${err.stack || ""}\n`);
    set.status = 500;
    return { error: "Internal server error" };
  })
  .listen({
    port: Number(process.env.PORT) || 3001,
    hostname: "0.0.0.0",
  });

Bun.write(Bun.stdout, `StockPilot backend running at http://localhost:${app.server?.port}\n`);
