import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RegisterWizard } from "@/components/auth/register-wizard";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { loadRegistration } from "../register-actions";

export const metadata: Metadata = { title: "Kostenlos anmelden" };

export default async function RegisterPage(props: PageProps<"/registrieren">) {
  if (await getSessionUser()) redirect("/dashboard");
  const sp = await props.searchParams;
  const typ = typeof sp.typ === "string" && ["member", "escort", "club"].includes(sp.typ) ? (sp.typ as "member" | "escort" | "club") : null;
  const initial = await loadRegistration();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Kostenlos anmelden</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Schon dabei?{" "}
          <Link href="/anmelden" className="font-semibold text-foreground underline">
            Hier einloggen
          </Link>
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <RegisterWizard initial={initial} initialType={typ} turnstileSiteKey={env.turnstileSiteKey ?? null} />
      </div>
    </div>
  );
}
