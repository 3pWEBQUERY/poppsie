"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestDeletion } from "@/lib/account/actions";

export function DataExport() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Lade eine Kopie deiner Daten als JSON-Datei herunter: Konto, Profil, Sprachen, Medienliste, Beiträge, Kommentare, gesendete Nachrichten, Berichte,
        Favoriten, Follows, Buchungen, Besuche und Mitteilungen (Auskunftsrecht nach revDSG und DSGVO). Daten anderer Personen sind nicht enthalten.
      </p>
      <div>
        <Button variant="secondary" asChild>
          <a href="/api/account/export" download>
            <Download /> Daten exportieren
          </a>
        </Button>
      </div>
    </div>
  );
}

export function DeleteAccount({ pending: alreadyPending }: { pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 text-sm">
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>Dein Profil wird sofort unsichtbar und du wirst auf allen Geräten abgemeldet.</li>
        <li>Nach 30 Tagen löschen wir dein Konto, Profil, Medien, Nachrichten und alle weiteren persönlichen Daten endgültig.</li>
        <li>Von dir geschriebene Berichte bleiben anonymisiert («gelöschtes Mitglied») erhalten.</li>
        <li>Meldest du dich innerhalb der 30 Tage wieder an, wird die Löschung abgebrochen.</li>
      </ul>
      {alreadyPending && <p className="text-warning">Für dein Konto ist bereits eine Löschung vorgemerkt.</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="w-fit">
            <Trash2 /> Konto löschen
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konto wirklich löschen?</DialogTitle>
            <DialogDescription>Bestätige mit deinem Passwort. Du hast danach 30 Tage Zeit, es dir anders zu überlegen.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await requestDeletion({ password });
                if (!res.ok) toast.error(res.error);
                else window.location.assign(res.data.redirect);
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-pw">Passwort</Label>
              <Input id="delete-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" variant="destructive" disabled={pending || !password}>
                {pending && <Loader2 className="animate-spin" />} Endgültig löschen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
