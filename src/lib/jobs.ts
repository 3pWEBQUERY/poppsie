import { db } from "@/db";
import { jobs } from "@/db/schema";

/** Job in die Postgres-Queue legen; ausgeführt vom Worker in server/worker.ts. */
export async function enqueue(type: string, payload: Record<string, unknown> = {}, runAt = new Date()) {
  await db.insert(jobs).values({ type, payload, runAt });
}
