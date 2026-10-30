import Link from "next/link";
import { EyeOff } from "lucide-react";

/** Hinweis für Eigentümer/Staff, wenn das Profil (noch) nicht öffentlich ist. */
export function PreviewNotice({ user, self }: { user: { profileHidden: boolean; kycStatus: string; accountType: string; status: string }; self: boolean }) {
  const reasons: { text: string; href?: string; cta?: string }[] = [];
  if (user.profileHidden) reasons.push({ text: "Dein Profil ist komplett ausgeblendet.", href: "/dashboard/sichtbarkeit", cta: "Sichtbarkeit" });
  if (user.accountType !== "member" && user.kycStatus !== "verified")
    reasons.push({ text: "Öffentlich sichtbar wird dein Profil erst nach der Verifikation.", href: "/dashboard/verifikation", cta: "Zur Verifikation" });
  if (user.status !== "active") reasons.push({ text: "Dieses Konto ist nicht aktiv." });
  if (!reasons.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center">
      <EyeOff className="size-4 shrink-0 text-warning" />
      <p className="flex-1">
        <strong>{self ? "Vorschau: Nur du siehst dieses Profil." : "Staff-Ansicht: Profil ist nicht öffentlich."}</strong> {reasons.map((r) => r.text).join(" ")}
      </p>
      {self &&
        reasons
          .filter((r) => r.href)
          .map((r) => (
            <Link key={r.href} href={r.href!} className="text-xs font-semibold underline underline-offset-2">
              {r.cta}
            </Link>
          ))}
    </div>
  );
}
