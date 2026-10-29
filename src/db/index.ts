import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { pgPool?: Pool; db?: Db };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt");
  const needsSsl = /sslmode=require/.test(url) || /proxy\.rlwy\.net/.test(url);
  return new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export function getPool() {
  if (!globalForDb.pgPool) globalForDb.pgPool = createPool();
  return globalForDb.pgPool;
}

export const db: Db = globalForDb.db ?? drizzle(getPool(), { schema });
if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export { schema };
