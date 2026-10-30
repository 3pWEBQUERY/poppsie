/**
 * Demo-Daten für die Entwicklung (Passwort für alle: "poppsie-demo-2026").
 * Aufruf: npx tsx scripts/seed-dev.ts
 */
import "../server/env";
import { seedDemo } from "@/db/seed/demo";

seedDemo({ password: "poppsie-demo-2026", adminPassword: "poppsie-demo-2026", adminRole: "admin" }).then(() => {
  console.log("Demo-Daten angelegt. Passwort: poppsie-demo-2026");
  process.exit(0);
});
