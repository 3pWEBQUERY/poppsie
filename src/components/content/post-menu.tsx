"use client";

import { useRef, useState } from "react";
import { Flag, Link2, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ReportDialog } from "@/components/shared/report-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EmbedRef } from "@/lib/content/types";
import { ShareDialog } from "./share-dialog";

export async function copyLink(href: string) {
  try {
    await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
    toast.success("Link kopiert");
  } catch {
    toast.error("Link konnte nicht kopiert werden");
  }
}

/** Menü für Beiträge und Kommentare: Link kopieren, Teilen, Bearbeiten, Löschen, Melden. */
export function PostMenu({
  href,
  share,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  report,
  loggedIn,
  deleteLabel = "Beitrag löschen",
}: {
  href?: string;
  share?: EmbedRef;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
  report?: { targetType: "post" | "comment" | "thread" | "story"; targetId: string; targetUserId?: string };
  loggedIn: boolean;
  deleteLabel?: string;
}) {
  const reportTrigger = useRef<HTMLSpanElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Weitere Aktionen" className="text-muted-foreground">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {href && (
            <DropdownMenuItem onSelect={() => copyLink(href)}>
              <Link2 /> Link kopieren
            </DropdownMenuItem>
          )}
          {share && loggedIn && (
            <DropdownMenuItem onSelect={() => setShareOpen(true)}>
              <Share2 /> Teilen in…
            </DropdownMenuItem>
          )}
          {canEdit && onEdit && (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Bearbeiten
            </DropdownMenuItem>
          )}
          {canDelete && onDelete && (
            <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive focus:text-destructive">
              <Trash2 /> Löschen
            </DropdownMenuItem>
          )}
          {report && loggedIn && !canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTimeout(() => reportTrigger.current?.click(), 0)}>
                <Flag /> Melden
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {report && loggedIn && <ReportDialog targetType={report.targetType} targetId={report.targetId} targetUserId={report.targetUserId} trigger={<span ref={reportTrigger} className="hidden" />} />}
      {share && shareOpen && <ShareDialog embed={share} open={shareOpen} onOpenChange={setShareOpen} />}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{deleteLabel}?</DialogTitle>
            <DialogDescription>Das kann nicht rückgängig gemacht werden.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onDelete?.();
                setBusy(false);
                setConfirm(false);
              }}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
