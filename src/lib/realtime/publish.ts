import { sql } from "drizzle-orm";
import { db } from "@/db";

export type RealtimeEvent =
  | { type: "message.new"; conversationId: string; messageId: string; senderId: string; preview?: string }
  | { type: "message.updated"; conversationId: string; messageId: string }
  | { type: "message.read"; conversationId: string; userId: string; at: string }
  | { type: "typing"; conversationId: string; userId: string }
  | { type: "booking.updated"; bookingId: string; conversationId?: string | null }
  | { type: "notification"; id: string; title: string; href?: string | null }
  | { type: "presence"; userId: string; online: boolean };

export const REALTIME_CHANNEL = "poppsie_rt";

/**
 * Echtzeit-Ereignis an Benutzer senden. Läuft über Postgres NOTIFY, damit jede App-Instanz
 * (WebSocket-Server in server.ts) die Ereignisse an ihre verbundenen Clients weiterreicht.
 */
export async function publish(userIds: string[], event: RealtimeEvent) {
  if (userIds.length === 0) return;
  const payload = JSON.stringify({ to: [...new Set(userIds)], event });
  if (payload.length > 7900) return; // NOTIFY-Limit 8000 Bytes
  await db.execute(sql`SELECT pg_notify(${REALTIME_CHANNEL}, ${payload})`);
}
