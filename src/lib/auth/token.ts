import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { sha256 } from "./crypto";

/** Ohne next/headers, damit auch der WebSocket-Server Sessions prüfen kann. */
export async function userFromToken(token: string): Promise<typeof users.$inferSelect | null> {
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user) return null;
  if (user.status === "deleted") return null;
  if (user.status === "suspended" && (!user.suspendedUntil || user.suspendedUntil > new Date())) return null;
  return user;
}

