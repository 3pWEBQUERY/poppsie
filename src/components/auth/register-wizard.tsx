"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check, Loader2, Sparkles, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { checkUsername, confirmCode, resendCode, saveAccountType, saveEmail, saveUsername } from "@/app/(auth)/register-actions";
import { CLUB_TYPES } from "@/lib/profile/fields";
import { cn } from "@/lib/utils";
import { PasswordStep } from "./password-step";

type AccountType = "member" | "escort" | "club";
type State = { username: string; email: string; accountType: AccountType | null; clubType: string | null };

const STEPS = ["Benutzername", "E-Mail", "Kontotyp", "Passwort", "Aktivierung"];

const TYPES: { value: AccountType; title: string; text: string; icon: typeof UserRound }[] = [
  { value: "member", title: "Mitglied", text: "Suchen, Favoriten, Berichte schreiben, buchen und chatten.", icon: UserRound },
  { value: "escort", title: "Escort", text: "Eigenes Profil, Galerie, Stories, Kalender und Statistiken.", icon: Sparkles },
  { value: "club", title: "Club / Studio", text: "Betriebsprofil, Öffnungszeiten, Preise und Line-up.", icon: Building2 },
];

export function RegisterWizard({
  initial,
  initialType,
  turnstileSiteKey,
}: {
  initial: { username: string | null; email: string | null; accountType: AccountType | null; clubType: string | null; codeSent: boolean; hasPassword: boolean } | null;
  initialType: AccountType | null;
  turnstileSiteKey: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(() => (initial?.codeSent ? 4 : initial?.accountType && initial.email ? 3 : initial?.email ? 2 : initial?.username ? 1 : 0));
  const [s, setS] = useState<State>({
    username: initial?.username ?? "",
    email: initial?.email ?? "",
    accountType: initial?.accountType ?? initialType,
    clubType: initial?.clubType ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = (fn: () => Promise<{ ok: boolean; error?: string }>, next: number) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Fehler");
      else setStep(next);
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Schritt {step + 1} von {STEPS.length}: <strong className="text-foreground">{STEPS[step]}</strong>
          </span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)} %</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} aria-label="Fortschritt der Registrierung" />
      </div>

      {step === 0 && (
        <UsernameStep
          value={s.username}
          onChange={(username) => setS({ ...s, username })}
          pending={pending}
          onSubmit={() => go(() => saveUsername(s.username, s.accountType ?? undefined), 1)}
        />
      )}
      {step === 1 && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => saveEmail(s.email), 2);
          }}
        >
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" type="email" autoComplete="email" autoFocus required value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} aria-invalid={Boolean(error)} />
          <p className="text-xs text-muted-foreground">An diese Adresse senden wir deinen Aktivierungscode. Sie wird nie öffentlich angezeigt.</p>
          <Button type="submit" disabled={pending || !s.email}>
            {pending && <Loader2 className="animate-spin" />} Weiter
          </Button>
        </form>
      )}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Wie möchtest du Poppsie nutzen?</p>
          <div className="grid gap-3" role="radiogroup" aria-label="Kontotyp">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={s.accountType === t.value}
                onClick={() => setS({ ...s, accountType: t.value, clubType: t.value === "club" ? s.clubType : null })}
                className={cn(
                  "flex items-start gap-4 rounded-lg border-2 bg-card p-4 text-left transition-colors hover:border-foreground/50",
                  s.accountType === t.value ? "border-primary" : "border-border",
                )}
              >
                <t.icon className={cn("mt-0.5 size-7 shrink-0", s.accountType === t.value ? "text-primary" : "text-muted-foreground")} />
                <span>
                  <span className="block font-display font-semibold">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.text}</span>
                </span>
                {s.accountType === t.value && <Check className="ml-auto size-5 text-primary" />}
              </button>
            ))}
          </div>
          {s.accountType === "club" && (
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
              <p className="text-sm font-medium">Art des Betriebs</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Club-Typ">
                {CLUB_TYPES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={s.clubType === c.value}
                    onClick={() => setS({ ...s, clubType: c.value })}
                    className={cn("rounded-md border px-3 py-2 text-sm transition-colors", s.clubType === c.value ? "border-primary bg-primary/10 font-semibold" : "hover:border-foreground/50")}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button disabled={pending || !s.accountType || (s.accountType === "club" && !s.clubType)} onClick={() => go(() => saveAccountType(s.accountType!, s.clubType), 3)}>
            {pending && <Loader2 className="animate-spin" />} Weiter
          </Button>
        </div>
      )}
      {step === 3 && (
        <PasswordStep
          userInputs={[s.username, s.email]}
          turnstileSiteKey={turnstileSiteKey}
          onDone={() => {
            setError(null);
            setStep(4);
          }}
          onError={setError}
        />
      )}
      {step === 4 && <CodeStep email={s.email} onSuccess={(to) => router.push(to)} />}

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {step > 0 && step < 4 && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setStep(step - 1)}>
          <ArrowLeft /> Zurück
        </Button>
      )}
    </div>
  );
}

function UsernameStep({ value, onChange, onSubmit, pending }: { value: string; onChange: (v: string) => void; onSubmit: () => void; pending: boolean }) {
  const [checked, setChecked] = useState<{ value: string; available: boolean; reason: string | null } | null>(null);
  const v = value.trim().toLowerCase();
  useEffect(() => {
    if (v.length < 3) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await checkUsername(v);
      if (alive) setChecked({ value: v, available: r.available, reason: r.reason });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [v]);
  // Zustand wird aus Eingabe und letzter Server-Prüfung abgeleitet
  const status =
    v.length < 3
      ? { checking: false, available: null, reason: v ? "Mindestens 3 Zeichen" : null }
      : checked?.value === v
        ? { checking: false, available: checked.available, reason: checked.reason }
        : { checking: true, available: null, reason: null };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (status.available) onSubmit();
      }}
    >
      <Label htmlFor="username">Benutzername</Label>
      <div className="relative">
        <Input
          id="username"
          autoFocus
          autoComplete="username"
          maxLength={20}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
          aria-invalid={status.available === false}
          aria-describedby="username-hint"
          className="pr-9"
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2">
          {status.checking ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : status.available ? (
            <Check className="size-4 text-success" aria-label="Verfügbar" />
          ) : status.available === false ? (
            <X className="size-4 text-destructive" aria-label="Nicht verfügbar" />
          ) : null}
        </span>
      </div>
      <p id="username-hint" aria-live="polite" className={cn("text-xs", status.available === false ? "text-destructive" : "text-muted-foreground")}>
        {status.available ? "Der Name ist verfügbar." : (status.reason ?? "3–20 Zeichen: a–z, 0–9, Punkt und Unterstrich. Der Name ist öffentlich sichtbar.")}
      </p>
      <Button type="submit" disabled={pending || !status.available || status.checking}>
        {pending && <Loader2 className="animate-spin" />} Weiter
      </Button>
    </form>
  );
}

function CodeStep({ email, onSuccess }: { email: string; onSuccess: (to: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);
  const [pending, start] = useTransition();
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = (value: string) =>
    start(async () => {
      setError(null);
      const res = await confirmCode(value);
      if (res.ok) onSuccess(res.data.redirect);
      else {
        setError(res.error);
        setCode("");
        // Feld war während der Prüfung deaktiviert: Fokus zurückgeben, damit direkt neu getippt werden kann
        setTimeout(() => otpRef.current?.focus(), 0);
      }
    });

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm">
        Wir haben einen 6-stelligen Code an <strong>{email || "deine E-Mail-Adresse"}</strong> gesendet. Er ist 15 Minuten gültig.
      </p>
      <InputOTP
        ref={otpRef}
        maxLength={6}
        value={code}
        onChange={(v) => setCode(v.replace(/\D/g, ""))}
        onComplete={submit}
        autoFocus
        inputMode="numeric"
        pattern="^[0-9]*$"
        aria-label="Aktivierungscode"
        disabled={pending}
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} aria-invalid={Boolean(error)} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending || code.length !== 6} onClick={() => submit(code)}>
        {pending && <Loader2 className="animate-spin" />} Konto aktivieren
      </Button>
      <Button
        variant="link"
        size="sm"
        disabled={cooldown > 0 || pending}
        onClick={() =>
          start(async () => {
            const res = await resendCode();
            if (res.ok) {
              toast.success("Neuer Code gesendet");
              setCooldown(60);
              setError(null);
            } else toast.error(res.error);
          })
        }
      >
        {cooldown > 0 ? `Code erneut senden (${cooldown} s)` : "Code erneut senden"}
      </Button>
    </div>
  );
}
