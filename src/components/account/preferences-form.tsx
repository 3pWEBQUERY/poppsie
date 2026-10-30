"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updatePreferences } from "@/lib/account/actions";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/config";

const FLAGS: Record<Locale, string> = { de: "ch", fr: "fr", it: "it", en: "gb" };

function zoneOptions() {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Europe/Zurich"];
  return zones.map((z) => {
    const [region] = z.split("/");
    return { value: z, label: z.replace(/_/g, " "), group: region };
  });
}

export function PreferencesForm({ locale, timezone }: { locale: string; timezone: string }) {
  const router = useRouter();
  const [lang, setLang] = useState(locale);
  const [tz, setTz] = useState(timezone);
  const [pending, start] = useTransition();
  const zones = useMemo(() => zoneOptions(), []);
  const dirty = lang !== locale || tz !== timezone;
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updatePreferences({ locale: lang as Locale, timezone: tz });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Einstellungen gespeichert");
            router.refresh();
          }
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label id="lang-label">Sprache</Label>
        <Select
          aria-labelledby="lang-label"
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l], flag: FLAGS[l] }))}
          value={lang}
          onChange={(v) => v && setLang(v)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label id="tz-label">Zeitzone</Label>
        <Select aria-labelledby="tz-label" options={zones} value={tz} searchable searchPlaceholder="Stadt suchen, z. B. Zurich" onChange={(v) => v && setTz(v)} />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Die Zeitzone wird für Termine, Erinnerungen und den Planer verwendet.</p>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || !dirty}>
          {pending && <Loader2 className="animate-spin" />} Speichern
        </Button>
      </div>
    </form>
  );
}
