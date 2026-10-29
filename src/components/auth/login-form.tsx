"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/app/(auth)/actions";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await login({ identifier, password, next });
          if (res.ok) {
            router.push(res.data.redirect);
            router.refresh();
          } else setError(res.error);
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="identifier">Benutzername oder E-Mail</Label>
        <Input id="identifier" autoComplete="username" autoFocus required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Passwort</Label>
          <Link href="/passwort-vergessen" className="text-xs text-muted-foreground underline">
            Passwort vergessen?
          </Link>
        </div>
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Einloggen
      </Button>
    </form>
  );
}
