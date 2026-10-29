"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, resetPassword } from "@/app/(auth)/actions";

export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (sent) return <p className="text-sm">Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen gesendet.</p>;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await requestPasswordReset(email);
          if (res.ok) setSent(true);
          else setError(res.error);
        });
      }}
    >
      <Label htmlFor="email">E-Mail-Adresse</Label>
      <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Link senden
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await resetPassword({ token, password, confirm });
          if (res.ok) router.push(res.data.redirect);
          else setError(res.error);
        });
      }}
    >
      <Label htmlFor="pw">Neues Passwort (min. 10 Zeichen)</Label>
      <Input id="pw" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <Label htmlFor="pw2">Bestätigen</Label>
      <Input id="pw2" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Passwort speichern
      </Button>
    </form>
  );
}
