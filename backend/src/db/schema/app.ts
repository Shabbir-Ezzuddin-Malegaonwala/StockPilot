import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    currentStock: integer("current_stock").notNull().default(0),
    reorderLevel: integer("reorder_level").notNull().default(10),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    aiRecommendation: varchar("ai_recommendation", { length: 50 }),
    aiReasoning: text("ai_reasoning"),
    aiAnalyzedAt: timestamp("ai_analyzed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("org_sku_unique").on(table.organizationId, table.sku),
  ]
);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  movementType: varchar("movement_type", { length: 20 }).notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  stockBefore: integer("stock_before").notNull(),
  stockAfter: integer("stock_after").notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
