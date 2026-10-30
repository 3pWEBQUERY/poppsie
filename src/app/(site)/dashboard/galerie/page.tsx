import type { Metadata } from "next";
import { GalleryManager } from "@/components/profile/gallery-manager";
import { requirePageUser } from "@/lib/auth/guards";
import { loadOwnMedia } from "@/lib/profiles/draft";

export const metadata: Metadata = { title: "Galerie" };

/** Galerie verwalten (Escorts und Clubs, auch bei unvollständigem Profil). */
export default async function GalleryPage() {
  const user = await requirePageUser({ types: ["escort", "club"], next: "/dashboard/galerie" });
  const m = await loadOwnMedia(user.id);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Galerie</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bis zu 50 Bilder und Videos. Das erste Bild erscheint gross auf deinem Profil.</p>
      </div>
      <GalleryManager
        initial={m.gallery}
        avatarId={m.avatar?.id ?? null}
        coverId={m.cover?.id ?? null}
        blurForGuests={m.blurForGuests}
        accountType={user.accountType as "escort" | "club"}
      />
    </div>
  );
}
