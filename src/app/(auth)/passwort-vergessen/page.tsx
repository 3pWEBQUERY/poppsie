import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/auth/reset-forms";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function ForgotPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">Passwort vergessen</h1>
      <div className="rounded-lg border bg-card p-6">
        <ResetRequestForm />
      </div>
    </div>
  );
}
