import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Info } from "lucide-react";
import { db } from "@/db";
import { clubTypeSchemas } from "@/db/schema";
import { Empty, PageTitle } from "@/components/admin/badges";
import { ClubSchemaEditor } from "@/components/admin/club-schema-editor";
import { requireStaffPage } from "@/lib/admin/guard";
import { formatDateTime } from "@/lib/admin/labels";

export const metadata: Metadata = { title: "Club-Typen" };

const ORDER = ["club", "studio", "laufhaus", "kontaktbar", "saunaclub", "nachtclub"];

export default async function ClubTypesPage() {
  await requireStaffPage();
  const rows = await db.select().from(clubTypeSchemas).orderBy(asc(clubTypeSchemas.clubType));
  const idx = (t: string) => (ORDER.includes(t) ? ORDER.indexOf(t) : ORDER.length);
  rows.sort((a, b) => idx(a.clubType) - idx(b.clubType));
  return (
    <div>
      <PageTitle title="Club-Typen" description="Welche Zusatzfelder Betriebe je Typ ausfüllen müssen, dürfen oder nicht sehen." />
      <p className="mb-4 flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Felder, Bezeichnungen, Optionen und Regeln lassen sich hier ohne Deploy ändern. Ein <strong>neuer Club-Typ</strong> braucht zusätzlich einen neuen
          Wert im Datenbank-Enum <code className="rounded bg-secondary px-1">club_type</code> (Migration) und einen Eintrag in{" "}
          <code className="rounded bg-secondary px-1">club_type_schemas</code>. Bestehende Profildaten bleiben beim Ausblenden eines Feldes erhalten.
        </span>
      </p>
      {rows.length === 0 ? (
        <Empty>Keine Schemas vorhanden. Sie werden beim Serverstart aus den Standardwerten angelegt.</Empty>
      ) : (
        <ClubSchemaEditor schemas={rows.map((r) => ({ clubType: r.clubType, label: r.label, fields: r.fields, updatedAt: formatDateTime(r.updatedAt) }))} />
      )}
    </div>
  );
}
