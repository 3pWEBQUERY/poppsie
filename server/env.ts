import { loadEnvConfig } from "@next/env";
import Module from "node:module";
import path from "node:path";

// Muss als erstes geladen werden: .env-Dateien wie bei `next dev` / `next start`.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

// Server-, Worker- und Skript-Code (tsx) darf Module mit `import "server-only"` nutzen.
type Resolve = (request: string, ...rest: unknown[]) => string;
const mod = Module as unknown as { _resolveFilename: Resolve };
const original = mod._resolveFilename;
mod._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.join(process.cwd(), "node_modules/server-only/empty.js");
  return original.call(this, request, ...rest);
};
