import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";

/** WebSocket-Server (wird vom Messenger-Modul implementiert). Nicht-/ws-Upgrades gehen an Next.js (HMR). */
export function attachWebSocket(server: Server, fallback: (req: IncomingMessage, socket: Duplex, head: Buffer) => void) {
  server.on("upgrade", (req, socket, head) => fallback(req, socket, head));
}
