import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./lib/auth";
import { productRoutes } from "./routes/products";
import { movementRoutes } from "./routes/movements";
import { aiRoutes } from "./routes/ai";
import { settingsRoutes } from "./routes/settings";

const FRONTEND_ORIGIN = process.env.FRONTEND_URL || "http://localhost:3000";

const app = new Elysia()
  .use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }))
  // BetterAuth handles all /api/auth/* routes
  // We must manually add CORS headers because Elysia's CORS middleware
  // does NOT add headers to raw Response objects returned by BetterAuth
  .all("/api/auth/*", async ({ request }) => {
    const response = await auth.handler(request);

    // Clone the response and add CORS headers manually
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    newHeaders.set("Access-Control-Allow-Credentials", "true");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
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
