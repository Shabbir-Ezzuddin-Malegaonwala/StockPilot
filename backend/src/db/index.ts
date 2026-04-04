import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

const isProduction = process.env.DATABASE_URL?.includes(".render.com");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export { pool };
export const db = drizzle(pool, { schema });
