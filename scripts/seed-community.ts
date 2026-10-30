/** Community-Demo-Daten. Aufruf: npx tsx scripts/seed-community.ts (nach scripts/seed-dev.ts). */
import "../server/env";
import { seedCommunity } from "@/db/seed/community";

seedCommunity().then((created) => {
  console.log(created ? "Community-Demo-Daten angelegt." : "Community-Demo-Daten sind bereits vorhanden.");
  process.exit(0);
});
