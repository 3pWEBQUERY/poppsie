import { loadEnvConfig } from "@next/env";

// Muss als erstes geladen werden: .env-Dateien wie bei `next dev` / `next start`.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
