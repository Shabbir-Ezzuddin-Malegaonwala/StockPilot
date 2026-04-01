import { Elysia } from "elysia";
import { getSessionAndRole, hasRole } from "../lib/session";
import * as productService from "../services/product.service";
import * as movementService from "../services/movement.service";
import * as aiService from "../services/ai.service";

/**
 * Helper: build SSE headers including CORS.
 * When we return a raw Response object, Elysia's CORS middleware does NOT
 * add headers automatically — so we include them ourselves.
 */
function sseHeaders(): Record<string, string> {
  const origin = process.env.FRONTEND_URL || "http://localhost:3000";
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
  };
}

/** Helper: create a one-shot SSE stream from a message string */
function sseMessage(content: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { headers: sseHeaders() });
}

export const aiRoutes = new Elysia({ prefix: "/ai" })
  // POST /ai/analyze/:productId — analyze single product (member+)
  .post("/analyze/:productId", async ({ headers, params, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }

    const product = await productService.getProductById(sessionData.organizationId, params.productId);
    if (!product) { set.status = 404; return { error: "Product not found" }; }

    const recentMovements = await movementService.getRecentMovements(
      sessionData.organizationId, params.productId, 10
    );

    try {
      const aiResult = await aiService.analyzeProduct({
        name: product.name,
        current_stock: product.currentStock,
        reorder_level: product.reorderLevel,
        category: product.category,
        recent_movements: recentMovements.map((m) => ({
          movement_type: m.movementType,
          quantity: m.quantity,
          created_at: m.createdAt.toISOString(),
        })),
      });

      await productService.updateProductAI(
        sessionData.organizationId,
        params.productId,
        aiResult.recommendation,
        aiResult.reasoning
      );

      const updated = await productService.getProductById(sessionData.organizationId, params.productId);
      return updated;
    } catch (err) {
      Bun.write(Bun.stderr, `[error] AI analysis failed for product ${params.productId}: ${err instanceof Error ? err.message : String(err)}\n`);
      set.status = 503;
      return { error: "AI service is unavailable" };
    }
  })

  // GET /ai/procurement-report — SSE stream (manager+)
  .get("/procurement-report", async ({ headers, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...sseHeaders() },
      });
    }
    if (!hasRole(sessionData.role, "manager")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...sseHeaders() },
      });
    }

    const allProducts = await productService.getAllActiveProducts(sessionData.organizationId);

    // No products — return a helpful SSE message
    if (allProducts.length === 0) {
      return sseMessage(
        "No active products found in your inventory. Add products first, then generate a report."
      );
    }

    try {
      // Fetch SSE stream from AI service
      const aiStream = await aiService.streamProcurementReport(
        allProducts.map((p) => ({
          name: p.name,
          sku: p.sku,
          current_stock: p.currentStock,
          reorder_level: p.reorderLevel,
          category: p.category,
          price: p.price,
        }))
      );

      // Re-emit the AI stream through our own ReadableStream
      // This ensures Bun fully controls the streaming lifecycle
      const reader = aiStream.getReader();
      const proxiedStream = new ReadableStream({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
          } catch {
            controller.close();
          }
        },
        cancel() {
          reader.cancel();
        },
      });

      return new Response(proxiedStream, { headers: sseHeaders() });
    } catch (err) {
      Bun.write(Bun.stderr, `[error] Procurement report failed: ${err instanceof Error ? err.message : String(err)}\n`);
      return sseMessage("AI service is currently unavailable. Please try again later.");
    }
  });
