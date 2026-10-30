import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { kycVerifications } from "@/db/schema";
import { VerificationPanel } from "@/components/profile/verification-panel";
import { requirePageUser } from "@/lib/auth/guards";
import { parseGestureCode } from "@/lib/profiles/kyc";

export const metadata: Metadata = { title: "Verifikation" };

type Status = "none" | "pending" | "verified" | "rejected";
const asStatus = (s: string | null | undefined): Status => (s === "pending" || s === "verified" || s === "rejected" ? s : "none");

/** KYC und Foto-Verifikation (Escorts und Clubs, auch bei unvollständigem Profil). */
export default async function VerificationPage() {
  const user = await requirePageUser({ types: ["escort", "club"], next: "/dashboard/verifikation" });
  const latest = async (kind: "identity" | "photo") =>
    (
      await db
        .select()
        .from(kycVerifications)
        .where(and(eq(kycVerifications.userId, user.id), eq(kycVerifications.kind, kind)))
        .orderBy(desc(kycVerifications.createdAt))
        .limit(1)
    )[0] ?? null;
  const [identity, photo] = await Promise.all([latest("identity"), latest("photo")]);
  const g = parseGestureCode(photo?.gestureCode ?? null);
  const identityStatus: Status = user.kycStatus === "verified" ? "verified" : asStatus(identity?.status ?? user.kycStatus);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Verifikation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verifizierte Profile erhalten das Abzeichen „Verifiziert“ und werden öffentlich angezeigt.</p>
      </div>
      <VerificationPanel
        identity={identityStatus}
        identityNote={identity?.status === "rejected" ? identity.note : null}
        photo={
          photo
            ? { id: photo.id, status: asStatus(photo.status), code: g?.code ?? null, gesture: g?.gesture ?? null, submitted: Boolean(photo.providerRef), note: photo.note }
            : null
        }
      />
    </div>
  );
}
