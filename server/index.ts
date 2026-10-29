import "./env";
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { bootstrap } from "./bootstrap";
import { startWorker } from "./worker";
import { attachWebSocket } from "./ws";

/**
 * Custom Server: Next.js + WebSockets (/ws) + Job-Worker (Planer, Erinnerungen, Broadcasts, Aggregation).
 * Railway startet ihn mit `npm start`.
 */
const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  await bootstrap();
  const server = createServer((req, res) => handle(req, res, parse(req.url ?? "/", true)));
  const upgradeNext = app.getUpgradeHandler();
  attachWebSocket(server, (req, socket, head) => upgradeNext(req, socket, head));
  server.listen(port, () => console.log(`> Poppsie läuft auf http://localhost:${port} (${dev ? "dev" : "production"})`));
  if (process.env.DISABLE_WORKER !== "1") startWorker();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
