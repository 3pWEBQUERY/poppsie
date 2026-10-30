"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { disableTotp, enableTotp, startTotp } from "@/lib/account/actions";

function CodeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <InputOTP id={id} maxLength={6} inputMode="numeric" pattern="^[0-9]*$" value={value} onChange={onChange} autoComplete="one-time-code">
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** Optionale Zwei-Faktor-Anmeldung mit Authenticator-App (TOTP, RFC 6238). */
export function TotpSection({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; uri: string; token: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success("Kopiert"), () => toast.error("Kopieren nicht möglich"));

  if (enabled) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-5 text-success" /> Die Zwei-Faktor-Anmeldung ist <Badge variant="success">aktiv</Badge>
        </p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await disableTotp({ password, code });
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Zwei-Faktor-Anmeldung deaktiviert");
                setPassword("");
                setCode("");
                router.refresh();
              }
            });
          }}
        >
          <p className="text-xs text-muted-foreground">Zum Deaktivieren brauchst du dein Passwort und einen aktuellen Code.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="totp-off-pw">Passwort</Label>
              <Input id="totp-off-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="totp-off-code">Code</Label>
              <CodeInput id="totp-off-code" value={code} onChange={setCode} />
            </div>
          </div>
          <div>
            <Button type="submit" variant="secondary" disabled={pending || !password || code.length !== 6}>
              {pending ? <Loader2 className="animate-spin" /> : <ShieldOff />} Deaktivieren
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Schütze dein Konto zusätzlich mit einem 6-stelligen Code aus einer Authenticator-App (z. B. Aegis, 1Password, Google Authenticator, Microsoft
          Authenticator). Danach brauchst du beim Login neben dem Passwort immer den Code.
        </p>
        <div>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await startTotp();
                if (!res.ok) toast.error(res.error);
                else setSetup(res.data);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Zwei-Faktor einrichten
          </Button>
        </div>
      </div>
    );
  }

  const grouped = setup.secret.match(/.{1,4}/g)?.join(" ") ?? setup.secret;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await enableTotp({ token: setup.token, code });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Zwei-Faktor-Anmeldung aktiviert");
            setSetup(null);
            setCode("");
            router.refresh();
          }
        });
      }}
    >
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>
          Öffne deine Authenticator-App und füge ein neues Konto hinzu. Auf dem Handy kannst du auch direkt den Link öffnen:{" "}
          <a href={setup.uri} className="font-semibold text-primary underline">
            In App öffnen
          </a>
        </li>
        <li className="flex flex-col gap-1.5">
          <span>Oder gib den Schlüssel manuell ein (zeitbasiert, 6 Stellen, 30 Sekunden):</span>
          <span className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border bg-background px-3 py-2 font-mono text-base tracking-wider break-all">{grouped}</code>
            <Button type="button" size="sm" variant="ghost" onClick={() => copy(setup.secret)}>
              <Copy /> Kopieren
            </Button>
          </span>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">otpauth-URI anzeigen</summary>
            <span className="mt-1 flex items-center gap-2">
              <code className="rounded bg-background px-2 py-1 break-all">{setup.uri}</code>
              <Button type="button" size="sm" variant="ghost" onClick={() => copy(setup.uri)}>
                <Copy />
              </Button>
            </span>
          </details>
        </li>
        <li className="flex flex-col gap-2">
          <span>Gib zur Bestätigung den aktuellen Code aus der App ein:</span>
          <CodeInput id="totp-code" value={code} onChange={setCode} />
        </li>
      </ol>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || code.length !== 6}>
          {pending && <Loader2 className="animate-spin" />} Aktivieren
        </Button>
        <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
