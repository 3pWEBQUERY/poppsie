import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-forms";

export const metadata: Metadata = { title: "Neues Passwort" };

export default async function ResetPage(props: PageProps<"/passwort-zuruecksetzen">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">Neues Passwort setzen</h1>
      <div className="rounded-lg border bg-card p-6">{token ? <ResetPasswordForm token={token} /> : <p className="text-sm">Der Link ist ungültig.</p>}</div>
    </div>
  );
}
