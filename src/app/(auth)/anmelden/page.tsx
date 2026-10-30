import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage(props: PageProps<"/anmelden">) {
  if (await getSessionUser()) redirect("/dashboard");
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Willkommen zurück</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Neu hier?{" "}
          <Link href="/registrieren" className="font-semibold text-foreground underline">
            Kostenlos anmelden
          </Link>
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <LoginForm next={next} />
      </div>
    </div>
  );
}
