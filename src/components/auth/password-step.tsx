"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePassword } from "@/app/(auth)/register-actions";
import { passwordStrength } from "@/lib/auth/strength";
import { cn } from "@/lib/utils";

const LABELS = ["Sehr schwach", "Schwach", "Okay", "Stark", "Sehr stark"];
const COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string };
  }
}

export function PasswordStep({
  userInputs,
  turnstileSiteKey,
  onDone,
  onError,
}: {
  userInputs: string[];
  turnstileSiteKey: string | null;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [result, setResult] = useState<{ for: string; score: number; warning: string } | null>(null);
  const inputsKey = userInputs.join("\n");
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!password) return;
    let alive = true;
    passwordStrength(password, inputsKey.split("\n")).then((r) => alive && setResult({ for: password, score: r.score, warning: r.warning }));
    return () => {
      alive = false;
    };
  }, [password, inputsKey]);
  // Nur das Ergebnis für das aktuelle Passwort anzeigen
  const score = password && result?.for === password ? result : null;

  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 10 && confirm === password && terms && adult && (score?.score ?? 0) >= 2 && (!turnstileSiteKey || turnstile);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          onError(null);
          const res = await savePassword({ password, confirm, terms, adult, turnstile });
          if (res.ok) onDone();
          else onError(res.error);
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Passwort</Label>
        <div className="relative">
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={tooShort}
            aria-describedby="pw-strength"
            className="pr-10"
          />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div id="pw-strength" aria-live="polite" className="flex flex-col gap-1">
          <div className="grid grid-cols-5 gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1 rounded-full bg-secondary", score && i <= score.score && COLORS[score.score])} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {tooShort ? "Mindestens 10 Zeichen" : score ? `${LABELS[score.score]}${score.warning ? ` – ${score.warning}` : ""}` : "Mindestens 10 Zeichen, am besten ein Satz aus mehreren Wörtern."}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Passwort bestätigen</Label>
        <Input id="confirm" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
        {mismatch && <span className="text-xs text-destructive">Die Passwörter stimmen nicht überein</span>}
      </div>
      <Label className="items-start font-normal leading-snug">
        <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
        <span>
          Ich akzeptiere die{" "}
          <Link href="/agb" target="_blank" className="underline">
            AGB
          </Link>{" "}
          und die{" "}
          <Link href="/datenschutz" target="_blank" className="underline">
            Datenschutzerklärung
          </Link>
          .
        </span>
      </Label>
      <Label className="items-start font-normal leading-snug">
        <Checkbox checked={adult} onCheckedChange={(v) => setAdult(v === true)} className="mt-0.5" />
        <span>Ich bestätige, dass ich mindestens 18 Jahre alt bin.</span>
      </Label>
      {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstile} />}
      <Button type="submit" disabled={pending || !canSubmit}>
        {pending && <Loader2 className="animate-spin" />} Code senden
      </Button>
    </form>
  );
}

function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string | null) => void }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!el || !loaded || !window.turnstile) return;
    window.turnstile.render(el, { sitekey: siteKey, theme: "dark", callback: onToken, "expired-callback": () => onToken(null) });
  }, [el, loaded, siteKey, onToken]);
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onLoad={() => setLoaded(true)} onReady={() => setLoaded(true)} />
      <div ref={setEl} />
    </>
  );
}
