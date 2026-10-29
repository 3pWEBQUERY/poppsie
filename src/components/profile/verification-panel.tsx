"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, Clock, IdCard, Loader2, RefreshCw, ShieldCheck, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startIdentityVerification, startPhotoVerification, submitVerificationSelfie } from "@/lib/profiles/kyc-actions";
import { cn } from "@/lib/utils";

type Status = "none" | "pending" | "verified" | "rejected";
type Photo = { id: string; status: Status; code: string | null; gesture: string | null; submitted: boolean; note: string | null } | null;

export function StatusBadge({ status }: { status: Status }) {
  if (status === "verified")
    return (
      <Badge variant="success">
        <BadgeCheck /> Verifiziert
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge variant="warning">
        <Clock /> In Prüfung
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge className="bg-destructive/15 text-destructive">
        <XCircle /> Abgelehnt
      </Badge>
    );
  return <Badge variant="muted">Nicht gestartet</Badge>;
}

function Card({ icon: Icon, title, status, children }: { icon: typeof IdCard; title: string; status: Status; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
            <Icon className="size-5 text-primary" />
          </span>
          <h2 className="text-base font-bold">{title}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      {children}
    </section>
  );
}

/** KYC (Identität) und Foto-Verifikation mit Gesten-Code. */
export function VerificationPanel({ identity, identityNote, photo }: { identity: Status; identityNote: string | null; photo: Photo }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const startIdentity = () =>
    start(async () => {
      const res = await startIdentityVerification();
      if (!res.ok) return void toast.error(res.error);
      if (res.data.redirectUrl) window.location.href = res.data.redirectUrl;
      else {
        toast.success("Verifikation gestartet. Wir melden uns, sobald die Prüfung abgeschlossen ist.");
        router.refresh();
      }
    });

  const newCode = () =>
    start(async () => {
      const res = await startPhotoVerification();
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });

  const upload = () =>
    start(async () => {
      if (!file || !photo) return;
      const fd = new FormData();
      fd.append("verificationId", photo.id);
      fd.append("file", file);
      const res = await submitVerificationSelfie(fd);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Selfie hochgeladen. Unser Team prüft es in Kürze.");
      setFile(null);
      setPreview(null);
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card icon={IdCard} title="Identität & Alter" status={identity}>
        <p className="text-sm text-muted-foreground">
          Damit dein Profil öffentlich sichtbar wird, prüfen wir deine Identität und dein Mindestalter von 18 Jahren mit Ausweis und Selfie-Abgleich.
        </p>
        <div className="flex items-start gap-2 rounded-md border bg-background p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p>Die Ausweisdokumente prüft unser KYC-Partner. Poppsie speichert keine Ausweisdaten oder -bilder – wir erhalten nur das Ergebnis und dein Geburtsdatum.</p>
        </div>
        {identity === "rejected" && identityNote && <p className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">Grund: {identityNote}</p>}
        {identity === "verified" ? (
          <p className="text-sm font-medium text-success">Deine Identität ist bestätigt. Das Verifiziert-Abzeichen erscheint auf deinem Profil.</p>
        ) : identity === "pending" ? (
          <p className="text-sm">Deine Prüfung läuft. Das dauert in der Regel weniger als 24 Stunden.</p>
        ) : (
          <Button onClick={startIdentity} disabled={pending} className="w-fit">
            {pending ? <Loader2 className="animate-spin" /> : <IdCard />} {identity === "rejected" ? "Erneut verifizieren" : "Identität verifizieren"}
          </Button>
        )}
      </Card>

      <Card icon={Camera} title="Foto-Verifikation" status={photo?.status ?? "none"}>
        <p className="text-sm text-muted-foreground">
          Zeig, dass deine Fotos echt sind: Mach ein Selfie mit dem Code auf einem Zettel und der angezeigten Geste. Das Selfie sieht nur unser Moderationsteam.
        </p>
        {photo?.status === "verified" ? (
          <p className="text-sm font-medium text-success">Deine Fotos sind verifiziert.</p>
        ) : photo?.status === "pending" && photo.submitted ? (
          <p className="text-sm">Dein Selfie wurde hochgeladen und wird geprüft.</p>
        ) : photo?.status === "pending" && photo.code ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border-2 border-dashed border-primary/60 bg-background p-4 text-center">
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Schreibe auf einen Zettel</p>
              <p className="font-display text-2xl font-extrabold tracking-wider">{photo.code}</p>
              <p className="mt-2 text-[11px] tracking-wide text-muted-foreground uppercase">und zeige diese Geste</p>
              <p className="text-sm font-semibold">{photo.gesture}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={input}
                type="file"
                accept="image/*"
                capture="user"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview((old) => {
                    if (old) URL.revokeObjectURL(old);
                    return f ? URL.createObjectURL(f) : null;
                  });
                }}
              />
              <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={pending}>
                <Camera /> {file ? "Anderes Foto" : "Selfie wählen"}
              </Button>
              <Button size="sm" onClick={upload} disabled={!file || pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Upload />} Hochladen
              </Button>
              <Button variant="ghost" size="sm" onClick={newCode} disabled={pending}>
                <RefreshCw /> Neuer Code
              </Button>
            </div>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Vorschau deines Selfies" className={cn("max-h-60 w-fit rounded-md border object-contain")} />
            )}
          </div>
        ) : (
          <>
            {photo?.status === "rejected" && photo.note && <p className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">Grund: {photo.note}</p>}
            <Button onClick={newCode} disabled={pending} className="w-fit" variant={photo?.status === "rejected" ? "default" : "secondary"}>
              {pending ? <Loader2 className="animate-spin" /> : <Camera />} {photo?.status === "rejected" ? "Erneut versuchen" : "Code anzeigen"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
