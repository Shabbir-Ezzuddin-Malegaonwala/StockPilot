import { Elysia } from "elysia";
import { getSessionAndRole, hasRole } from "../lib/session";
import {
  createProductSchema,
  updateProductSchema,
  adjustStockSchema,
  productQuerySchema,
  movementQuerySchema,
} from "../schemas/validation";
import * as productService from "../services/product.service";
import * as movementService from "../services/movement.service";
import * as aiService from "../services/ai.service";
import { db } from "../db";
import { products } from "../db/schema/app";
import { eq, and, sql } from "drizzle-orm";

export const productRoutes = new Elysia({ prefix: "/products" })
  // GET /products/stats — dashboard summary stats (member+)
  .get("/stats", async ({ headers, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }

    return productService.getProductStats(sessionData.organizationId);
  })

  // GET /products/categories — unique categories for filter dropdown (member+)
  .get("/categories", async ({ headers, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }

    const categories = await productService.getCategories(sessionData.organizationId);
    return { data: categories };
  })

  // GET /products — list products (member+)
  .get("/", async ({ headers, query, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }

    const parsed = productQuerySchema.safeParse(query);
    if (!parsed.success) { set.status = 400; return { error: parsed.error.flatten().fieldErrors }; }

    const result = await productService.getProducts(sessionData.organizationId, parsed.data);
    return result;
  })

  // GET /products/:id — get single product (member+)
  .get("/:id", async ({ headers, params, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }

    const product = await productService.getProductById(sessionData.organizationId, params.id);
    if (!product) { set.status = 404; return { error: "Product not found" }; }

    const movements = await movementService.getRecentMovements(sessionData.organizationId, params.id, 10);
    return { ...product, recentMovements: movements };
  })

  // POST /products — create product (manager+)
  .post("/", async ({ headers, body, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "manager")) { set.status = 403; return { error: "Forbidden" }; }

    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: parsed.error.flatten().fieldErrors }; }

    const result = await productService.createProduct(sessionData.organizationId, parsed.data, sessionData.userId);
    if (result.error === "DUPLICATE_SKU") { set.status = 409; return { error: "SKU already exists in this organization" }; }

    set.status = 201;
    return result.data;
  })

  // PUT /products/:id — update product (manager+)
  .put("/:id", async ({ headers, params, body, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "manager")) { set.status = 403; return { error: "Forbidden" }; }

    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: parsed.error.flatten().fieldErrors }; }

    const result = await productService.updateProduct(sessionData.organizationId, params.id, parsed.data);
    if (result.error === "NOT_FOUND") { set.status = 404; return { error: "Product not found" }; }

    return result.data;
  })

  // DELETE /products/:id — soft delete (admin only)
  .delete("/:id", async ({ headers, params, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "admin")) { set.status = 403; return { error: "Forbidden" }; }

    const result = await productService.softDeleteProduct(sessionData.organizationId, params.id);
    if (result.error === "NOT_FOUND") { set.status = 404; return { error: "Product not found" }; }

    return result.data;
  })

  // PATCH /products/:id/stock — adjust stock (member+)
  .patch("/:id/stock", async ({ headers, params, body, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }

    const parsed = adjustStockSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: parsed.error.flatten().fieldErrors }; }

    // Use a database transaction to prevent race conditions on concurrent stock adjustments.
    // This ensures the read-check-update-log sequence is atomic — two simultaneous requests
    // cannot both read the same stock value and both pass the negative stock check.
    const txResult = await db.transaction(async (tx) => {
      // Lock the product row with FOR UPDATE to prevent concurrent reads
      const [product] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, params.id), eq(products.organizationId, sessionData.organizationId)))
        .for("update");

      if (!product) return { error: "NOT_FOUND" as const };

      const newStock = product.currentStock + parsed.data.quantity;
      if (newStock < 0) return { error: "NEGATIVE_STOCK" as const };

      // Update stock within the same transaction
      await tx
        .update(products)
        .set({ currentStock: newStock, updatedAt: new Date() })
        .where(and(eq(products.id, params.id), eq(products.organizationId, sessionData.organizationId)));

      // Log movement within the same transaction (immutable record)
      await movementService.createMovementTx(tx, {
        organizationId: sessionData.organizationId,
        productId: params.id,
        movementType: parsed.data.movementType,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason,
        stockBefore: product.currentStock,
        stockAfter: newStock,
        createdBy: sessionData.userId,
      });

      return { data: { product, newStock } };
    });

    if (txResult.error === "NOT_FOUND") { set.status = 404; return { error: "Product not found" }; }
    if (txResult.error === "NEGATIVE_STOCK") { set.status = 400; return { error: "Stock cannot go below zero" }; }

    // AI analysis runs OUTSIDE the transaction — non-blocking, don't fail stock adjustment if AI is down
    try {
      const recentMovements = await movementService.getRecentMovements(sessionData.organizationId, params.id, 10);
      const aiResult = await aiService.analyzeProduct({
        name: txResult.data!.product.name,
        current_stock: txResult.data!.newStock,
        reorder_level: txResult.data!.product.reorderLevel,
        category: txResult.data!.product.category,
        recent_movements: recentMovements.map((m) => ({
          movement_type: m.movementType,
          quantity: m.quantity,
          created_at: m.createdAt.toISOString(),
        })),
      });
      await productService.updateProductAI(
        sessionData.organizationId,
        params.id,
        aiResult.recommendation,
        aiResult.reasoning
      );
    } catch (err) {
      Bun.write(Bun.stderr, `[warn] AI analysis failed for product ${params.id}: ${err instanceof Error ? err.message : "unknown error"}\n`);
    }

    const updated = await productService.getProductById(sessionData.organizationId, params.id);
    return updated;
  })

  // GET /products/:id/movements — get movements for a product (member+)
  .get("/:id/movements", async ({ headers, params, query, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }

    const product = await productService.getProductById(sessionData.organizationId, params.id);
    if (!product) { set.status = 404; return { error: "Product not found" }; }

    const parsed = movementQuerySchema.safeParse(query);
    if (!parsed.success) { set.status = 400; return { error: parsed.error.flatten().fieldErrors }; }

    return movementService.getMovementsByProduct(sessionData.organizationId, params.id, parsed.data.page, parsed.data.limit);
  });
