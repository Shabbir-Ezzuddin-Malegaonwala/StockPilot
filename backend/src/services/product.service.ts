import { db } from "../db";
import { products, stockMovements } from "../db/schema/app";
import { eq, and, ilike, or, sql, count } from "drizzle-orm";
import type { CreateProductInput, UpdateProductInput, ProductQuery } from "../schemas/validation";

// ─── SKU Auto-Generation ─────────────────────────────────────────────────────
// Generates a unique SKU from the category prefix (or product name) + sequential number.
// Example: category "Electronics" → ELE-001, ELE-002, etc.
// If no category, uses first 3 chars of product name: "Ballpoint Pen" → BAL-001

async function generateSKU(organizationId: string, name: string, category?: string | null): Promise<string> {
  // Build prefix from category or product name (first 3 chars, uppercase)
  const source = category && category.trim().length >= 3 ? category.trim() : name.trim();
  const prefix = source
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, "X"); // replace non-alpha chars with X for safety

  // Count existing products with same prefix in this org to determine sequence
  const result = await db
    .select({ count: count() })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        sql`${products.sku} LIKE ${prefix + "-%"}`
      )
    );

  const nextNum = Number(result[0]?.count ?? 0) + 1;
  const padded = String(nextNum).padStart(3, "0");
  const sku = `${prefix}-${padded}`;

  // Verify uniqueness (in case of gaps in sequence)
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.sku, sku)));

  if (existing.length > 0) {
    // Collision — find the real max sequence number
    const maxResult = await db.execute(
      sql`SELECT MAX(CAST(SPLIT_PART(sku, '-', 2) AS INTEGER)) as max_seq
          FROM products
          WHERE organization_id = ${organizationId} AND sku LIKE ${prefix + "-%"}`
    );
    const maxSeq = Number((maxResult.rows[0] as { max_seq: number })?.max_seq ?? 0);
    return `${prefix}-${String(maxSeq + 1).padStart(3, "0")}`;
  }

  return sku;
}

// ─── Product CRUD ────────────────────────────────────────────────────────────

export async function getProducts(organizationId: string, query: ProductQuery) {
  const { page, limit, category, status, stockLevel, search } = query;
  const offset = (page - 1) * limit;

  const conditions = [eq(products.organizationId, organizationId)];

  if (category) {
    conditions.push(eq(products.category, category));
  }

  if (status !== "all") {
    conditions.push(eq(products.status, status));
  }

  if (stockLevel === "low") {
    conditions.push(
      sql`${products.currentStock} > 0 AND ${products.currentStock} < ${products.reorderLevel}`
    );
  } else if (stockLevel === "out") {
    conditions.push(eq(products.currentStock, 0));
  }

  if (search) {
    conditions.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(products.sku, `%${search}%`)
      )!
    );
  }

  const where = and(...conditions);

  const [data, totalResult] = await Promise.all([
    db.select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      category: products.category,
      price: products.price,
      currentStock: products.currentStock,
      reorderLevel: products.reorderLevel,
      status: products.status,
      createdAt: products.createdAt,
    }).from(products).where(where).limit(limit).offset(offset).orderBy(products.createdAt),
    db.select({ count: count() }).from(products).where(where),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return { data, total, page, limit };
}

export async function getProductById(organizationId: string, productId: string) {
  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)));

  return result[0] ?? null;
}

/**
 * Create a new product with auto-generated SKU and optional opening stock.
 * If initialStock > 0, a "received" movement with reason "Opening stock" is created atomically.
 */
export async function createProduct(organizationId: string, input: CreateProductInput, createdBy: string) {
  // Auto-generate SKU if not provided
  const sku = input.sku || await generateSKU(organizationId, input.name, input.category);

  // Check for duplicate SKU
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.sku, sku)));

  if (existing.length > 0) {
    return { error: "DUPLICATE_SKU" as const };
  }

  const initialStock = input.initialStock ?? 0;

  // Use a transaction to atomically create product + opening stock movement
  const txResult = await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        name: input.name,
        sku,
        description: input.description,
        category: input.category,
        price: input.price.toString(),
        currentStock: initialStock,
        reorderLevel: input.reorderLevel ?? 10,
        organizationId,
      })
      .returning();

    // If initial stock > 0, create an "Opening stock" movement record
    if (initialStock > 0) {
      await tx.insert(stockMovements).values({
        organizationId,
        productId: product.id,
        movementType: "received",
        quantity: initialStock,
        reason: "Opening stock",
        stockBefore: 0,
        stockAfter: initialStock,
        createdBy,
      });
    }

    return product;
  });

  return { data: txResult };
}

export async function updateProduct(organizationId: string, productId: string, input: UpdateProductInput) {
  const product = await getProductById(organizationId, productId);
  if (!product) return { error: "NOT_FOUND" as const };

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.price !== undefined) updateData.price = input.price.toString();
  if (input.reorderLevel !== undefined) updateData.reorderLevel = input.reorderLevel;

  const result = await db
    .update(products)
    .set(updateData)
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
    .returning();

  return { data: result[0] };
}

export async function softDeleteProduct(organizationId: string, productId: string) {
  const product = await getProductById(organizationId, productId);
  if (!product) return { error: "NOT_FOUND" as const };

  const result = await db
    .update(products)
    .set({ status: "discontinued", updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
    .returning();

  return { data: result[0] };
}

export async function updateProductStock(organizationId: string, productId: string, newStock: number) {
  await db
    .update(products)
    .set({ currentStock: newStock, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)));
}

export async function getAllActiveProducts(organizationId: string) {
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      category: products.category,
      price: products.price,
      currentStock: products.currentStock,
      reorderLevel: products.reorderLevel,
    })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.status, "active")))
    .orderBy(products.createdAt);
}

export async function getProductStats(organizationId: string) {
  const result = await db
    .select({
      total: count(),
      lowStock: sql<number>`count(*) filter (where ${products.currentStock} > 0 and ${products.currentStock} < ${products.reorderLevel})`,
      outOfStock: sql<number>`count(*) filter (where ${products.currentStock} = 0)`,
      totalValue: sql<number>`COALESCE(SUM(CAST(${products.price} AS NUMERIC) * ${products.currentStock}), 0)`,
    })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.status, "active")));

  return {
    totalProducts: Number(result[0]?.total ?? 0),
    lowStockCount: Number(result[0]?.lowStock ?? 0),
    outOfStockCount: Number(result[0]?.outOfStock ?? 0),
    totalInventoryValue: Number(result[0]?.totalValue ?? 0),
  };
}

export async function getCategories(organizationId: string) {
  const result = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), sql`${products.category} is not null`))
    .orderBy(products.category);

  return result.map((r) => r.category).filter(Boolean);
}

export async function updateProductAI(
  organizationId: string,
  productId: string,
  recommendation: string,
  reasoning: string
) {
  await db
    .update(products)
    .set({
      aiRecommendation: recommendation,
      aiReasoning: reasoning,
      aiAnalyzedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)));
}
