"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Ghost, MessageSquareText, Radio } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { updatePrivacy } from "@/lib/profiles/privacy-actions";
import { cn } from "@/lib/utils";

type State = { profileHidden: boolean; incognito: boolean; showOnline: boolean; readReceipts: boolean };

/** Hauptschalter "sichtbar / ausblenden" und Privatsphäre-Optionen. */
export function PrivacySettings({ initial }: { initial: State }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();

  const save = (patch: Partial<State>) => {
    const prev = s;
    setS({ ...s, ...patch });
    start(async () => {
      const res = await updatePrivacy(patch);
      if (!res.ok) {
        setS(prev);
        toast.error(res.error);
      }
    });
  };

  const options = [
    { hidden: false, icon: Eye, title: "Profil für alle sichtbar", text: "Dein Profil erscheint in Suche, Feed und Stories – ausser in gesperrten Ländern." },
    { hidden: true, icon: EyeOff, title: "Profil komplett ausblenden", text: "Niemand findet dein Profil. Bestehende Chats bleiben lesbar." },
  ];

  const toggles: { key: keyof State; icon: typeof Ghost; title: string; text: string }[] = [
    { key: "incognito", icon: Ghost, title: "Inkognito", text: "Deine Profilbesuche und Story-Aufrufe erscheinen nur als „Anonymes Mitglied“ mit Milchglas-Avatar." },
    { key: "showOnline", icon: Radio, title: "Online-Status zeigen", text: "Andere sehen, wenn du gerade online bist." },
    { key: "readReceipts", icon: MessageSquareText, title: "Lesebestätigungen", text: "Andere sehen, wann du ihre Nachrichten gelesen hast. Ausgeschaltet siehst du es bei anderen auch nicht." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Sichtbarkeit des Profils" className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const active = s.profileHidden === o.hidden;
          return (
            <button
              key={String(o.hidden)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => !active && save({ profileHidden: o.hidden })}
              className={cn("flex items-start gap-3 rounded-lg border-2 bg-card p-4 text-left transition-colors", active ? "border-primary" : "border-border hover:border-foreground/40")}
            >
              <o.icon className={cn("mt-0.5 size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-semibold">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.text}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col divide-y rounded-lg border bg-card">
        {toggles.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-start gap-3 p-4">
            <t.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">
              <span className="block text-sm font-semibold">{t.title}</span>
              <span className="block text-xs text-muted-foreground">{t.text}</span>
            </span>
            <Switch checked={s[t.key]} onCheckedChange={(v) => save({ [t.key]: v })} aria-label={t.title} />
          </label>
        ))}
      </div>
    </div>
  );
}
