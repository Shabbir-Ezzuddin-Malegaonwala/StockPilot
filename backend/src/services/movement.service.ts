import { db } from "../db";
import { stockMovements } from "../db/schema/app";
import { eq, and, desc, count } from "drizzle-orm";
import type { MovementQuery } from "../schemas/validation";

interface MovementData {
  organizationId: string;
  productId: string;
  movementType: string;
  quantity: number;
  reason?: string;
  stockBefore: number;
  stockAfter: number;
  createdBy: string;
}

export async function createMovement(data: MovementData) {
  const result = await db.insert(stockMovements).values(data).returning();
  return result[0];
}

/**
 * Creates a stock movement record within an existing database transaction.
 * Used by the stock adjustment endpoint to ensure atomic read-check-update-log operations.
 */
export async function createMovementTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], data: MovementData) {
  const result = await tx.insert(stockMovements).values(data).returning();
  return result[0];
}

export async function getMovementsByProduct(
  organizationId: string,
  productId: string,
  page: number = 1,
  limit: number = 20
) {
  const offset = (page - 1) * limit;

  const movementCols = {
    id: stockMovements.id,
    movementType: stockMovements.movementType,
    quantity: stockMovements.quantity,
    reason: stockMovements.reason,
    stockBefore: stockMovements.stockBefore,
    stockAfter: stockMovements.stockAfter,
    createdBy: stockMovements.createdBy,
    createdAt: stockMovements.createdAt,
  };

  const [data, totalResult] = await Promise.all([
    db
      .select(movementCols)
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.productId, productId),
          eq(stockMovements.organizationId, organizationId)
        )
      )
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.productId, productId),
          eq(stockMovements.organizationId, organizationId)
        )
      ),
  ]);

  return { data, total: totalResult[0]?.count ?? 0, page, limit };
}

export async function getAllMovements(organizationId: string, query: MovementQuery) {
  const { page, limit, productId, movementType } = query;
  const offset = (page - 1) * limit;

  const conditions = [eq(stockMovements.organizationId, organizationId)];

  if (productId) {
    conditions.push(eq(stockMovements.productId, productId));
  }

  if (movementType) {
    conditions.push(eq(stockMovements.movementType, movementType));
  }

  const where = and(...conditions);

  const movementCols = {
    id: stockMovements.id,
    productId: stockMovements.productId,
    movementType: stockMovements.movementType,
    quantity: stockMovements.quantity,
    reason: stockMovements.reason,
    stockBefore: stockMovements.stockBefore,
    stockAfter: stockMovements.stockAfter,
    createdBy: stockMovements.createdBy,
    createdAt: stockMovements.createdAt,
  };

  const [data, totalResult] = await Promise.all([
    db.select(movementCols).from(stockMovements).where(where).orderBy(desc(stockMovements.createdAt)).limit(limit).offset(offset),
    db.select({ count: count() }).from(stockMovements).where(where),
  ]);

  return { data, total: totalResult[0]?.count ?? 0, page, limit };
}

export async function getRecentMovements(organizationId: string, productId: string, limit: number = 10) {
  return db
    .select({
      id: stockMovements.id,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity,
      reason: stockMovements.reason,
      stockBefore: stockMovements.stockBefore,
      stockAfter: stockMovements.stockAfter,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.productId, productId),
        eq(stockMovements.organizationId, organizationId)
      )
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}
