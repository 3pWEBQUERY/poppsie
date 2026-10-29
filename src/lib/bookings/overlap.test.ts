/**
 * Integrationstest: Exclusion-Constraint bookings_no_overlap gegen die lokale DB.
 * Ausführen: npx tsx --test src/lib/bookings/overlap.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { computeSlots } from "./slots";
import { isOverlapError, parseRange, toRange } from "./range";

loadEnvConfig(process.cwd(), true);

async function withTx(fn: (c: Client, escortId: string, memberId: string) => Promise<void>) {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    const ids = await c.query<{ id: string; account_type: string }>("SELECT id, account_type FROM users WHERE account_type IN ('escort','member') ORDER BY account_type LIMIT 50");
    const escort = ids.rows.find((r) => r.account_type === "escort");
    const member = ids.rows.find((r) => r.account_type === "member");
    assert.ok(escort && member, "Demo-Daten fehlen (npx tsx scripts/seed-dev.ts)");
    await fn(c, escort.id, member.id);
  } finally {
    await c.query("ROLLBACK");
    await c.end();
  }
}

const insert = (c: Client, escortId: string, memberId: string, from: string, to: string, blocking: boolean) =>
  c.query("INSERT INTO bookings (escort_id, member_id, during, duration_min, blocking) VALUES ($1, $2, $3::tstzrange, 60, $4)", [
    escortId,
    memberId,
    toRange(new Date(from), new Date(to)),
    blocking,
  ]);

test("zwei überlappende blockierende Buchungen werden von der DB abgelehnt", async () => {
  await withTx(async (c, escortId, memberId) => {
    await insert(c, escortId, memberId, "2031-01-06T14:00:00Z", "2031-01-06T15:00:00Z", true);
    await c.query("SAVEPOINT s1");
    await assert.rejects(insert(c, escortId, memberId, "2031-01-06T14:30:00Z", "2031-01-06T15:30:00Z", true), (err: unknown) => {
      assert.equal((err as { code?: string }).code, "23P01");
      assert.ok(isOverlapError(err));
      return true;
    });
    await c.query("ROLLBACK TO SAVEPOINT s1");
    // Angrenzend (halboffenes Intervall) ist erlaubt, nicht blockierend ebenfalls
    await insert(c, escortId, memberId, "2031-01-06T15:00:00Z", "2031-01-06T16:00:00Z", true);
    await insert(c, escortId, memberId, "2031-01-06T14:15:00Z", "2031-01-06T14:45:00Z", false);
    // Bestätigen (blocking = true) einer überlappenden, freigegebenen Anfrage scheitert ebenfalls
    await c.query("SAVEPOINT s2");
    await assert.rejects(c.query("UPDATE bookings SET blocking = true WHERE escort_id = $1 AND NOT blocking", [escortId]), (err: unknown) => isOverlapError(err));
    await c.query("ROLLBACK TO SAVEPOINT s2");
  });
});

test("tstzrange aus Postgres wird korrekt geparst", () => {
  const r = parseRange('["2026-10-29 14:00:00+00","2026-10-29 15:30:00+00")');
  assert.equal(r?.start.toISOString(), "2026-10-29T14:00:00.000Z");
  assert.equal(r?.end.toISOString(), "2026-10-29T15:30:00.000Z");
});

test("Slots: Regeln − Ausnahmen − Buchungen mit Puffer, Vorlauf und Zeitzone", () => {
  // Montag 2031-01-06, Zürich = UTC+1. Verfügbar 14–18 Uhr lokal.
  const days = computeSlots({
    timezone: "Europe/Zurich",
    rules: [{ weekday: 0, startMin: 840, endMin: 1080 }],
    exceptions: [{ dateFrom: "2031-01-07", dateTo: "2031-01-07", kind: "unavailable", startMin: null, endMin: null }],
    busy: [{ start: new Date("2031-01-06T14:00:00Z"), end: new Date("2031-01-06T15:00:00Z") }], // 15–16 Uhr lokal
    bufferMin: 30,
    minLeadMin: 60,
    durationMin: 60,
    fromDate: "2031-01-06",
    days: 2,
    now: new Date("2031-01-01T00:00:00Z"),
  });
  const times = days[0]!.slots.map((s) => s.start.slice(11, 16));
  // lokal 14:00 (13 UTC) endet 15:00, Puffer 30 → kollidiert; erst 16:30 lokal (15:30 UTC) frei
  assert.deepEqual(times, ["15:30", "16:00"]);
  assert.equal(days[1]!.slots.length, 0);
});
