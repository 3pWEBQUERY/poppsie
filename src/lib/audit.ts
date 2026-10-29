import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { clientIp } from "@/lib/request";

export async function audit(actorId: string | null, action: string, target?: { type: string; id: string }, meta?: Record<string, unknown>) {
  await db.insert(auditLog).values({
    actorId,
    action,
    targetType: target?.type,
    targetId: target?.id,
    meta,
    ip: await clientIp().catch(() => null),
  });
}
