"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeEmail, changePassword } from "@/lib/account/actions";
import { passwordStrength } from "@/lib/auth/strength";
import { cn } from "@/lib/utils";

const LABELS = ["Sehr schwach", "Schwach", "Okay", "Stark", "Sehr stark"];
const COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];

export function EmailForm({ email }: { email: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await changeEmail({ email: value, password });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("E-Mail-Adresse geändert");
            setValue("");
            setPassword("");
            router.refresh();
          }
        });
      }}
    >
      <p className="text-sm sm:col-span-2">
        Aktuell: <span className="font-semibold">{email}</span>
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-email">Neue E-Mail-Adresse</Label>
        <Input id="new-email" type="email" autoComplete="email" required value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email-pw">Aktuelles Passwort</Label>
        <Input id="email-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || !value || !password}>
          {pending && <Loader2 className="animate-spin" />} E-Mail ändern
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm({ userInputs }: { userInputs: string[] }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [rawScore, setScore] = useState<{ score: number; warning: string } | null>(null);
  const [pending, start] = useTransition();
  const inputsKey = userInputs.join("|");

  useEffect(() => {
    if (!password) return;
    let alive = true;
    passwordStrength(password, inputsKey.split("|")).then((r) => alive && setScore({ score: r.score, warning: r.warning }));
    return () => {
      alive = false;
    };
  }, [password, inputsKey]);

  const score = password ? rawScore : null;
  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = current && password.length >= 10 && confirm === password && (score?.score ?? 0) >= 2;

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await changePassword({ current, password, confirm });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Passwort geändert. Andere Geräte wurden abgemeldet.");
            setCurrent("");
            setPassword("");
            setConfirm("");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2 sm:max-w-[calc(50%-0.375rem)]">
        <Label htmlFor="pw-current">Aktuelles Passwort</Label>
        <Input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-new">Neues Passwort</Label>
        <div className="relative">
          <Input
            id="pw-new"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={tooShort}
            aria-describedby="pw-new-strength"
            className="pr-10"
          />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div id="pw-new-strength" aria-live="polite" className="flex flex-col gap-1">
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-confirm">Neues Passwort bestätigen</Label>
        <Input id="pw-confirm" type={show ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
        {mismatch && <span className="text-xs text-destructive">Die Passwörter stimmen nicht überein</span>}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending && <Loader2 className="animate-spin" />} Passwort ändern
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Das Passwort wird zusätzlich gegen bekannte Datenlecks geprüft (anonym, k-Anonymity).</p>
      </div>
    </form>
  );
}
