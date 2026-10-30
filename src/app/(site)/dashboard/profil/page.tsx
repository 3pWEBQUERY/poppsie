import type { Metadata } from "next";
import { ProfileEditor } from "@/components/profile-wizard/profile-editor";
import { requirePageUser } from "@/lib/auth/guards";
import { loadDraft } from "@/lib/profiles/draft";
import { getSummary } from "@/lib/users/summary";

export const metadata: Metadata = { title: "Profil bearbeiten" };

/** Profil bearbeiten – auch bei unvollständigem Profil erlaubt. */
export default async function ProfilePage(props: PageProps<"/dashboard/profil">) {
  const user = await requirePageUser({ next: "/dashboard/profil" });
  const sp = await props.searchParams;
  const draft = await loadDraft(user);
  const me = await getSummary(user.id, user);
  const tab = typeof sp.tab === "string" ? sp.tab : null;
  return <ProfileEditor initial={draft} initialTab={tab} publicHref={me?.href ?? "/dashboard"} />;
}
