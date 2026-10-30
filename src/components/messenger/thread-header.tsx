"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, BadgeCheck, Ban, Bell, BellOff, Flag, MoreVertical, Pin, PinOff, UserRound } from "lucide-react";
import { ReportDialog } from "@/components/shared/report-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ThreadMeta } from "@/lib/messaging/types";
import { lastSeenLabel } from "./format";

type Flag = "pinned" | "archived" | "muted";

export function ThreadHeader({
  meta,
  typing,
  reportMessageId,
  onBack,
  onFlag,
  onBlock,
  onUnblock,
}: {
  meta: ThreadMeta;
  typing: boolean;
  reportMessageId: string | null;
  onBack: () => void;
  onFlag: (flag: Flag, value: boolean) => void;
  onBlock: () => Promise<void>;
  onUnblock: () => Promise<void>;
}) {
  const p = meta.partner;
  const reportRef = useRef<HTMLButtonElement>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = typing ? "schreibt …" : p.online ? "Online" : lastSeenLabel(p.lastSeenAt);

  return (
    <div className="flex items-center gap-2 border-b px-2 py-2 sm:px-3">
      <button type="button" onClick={onBack} aria-label="Zurück zur Übersicht" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden">
        <ArrowLeft className="size-5" />
      </button>
      <UserAvatar user={p} size="sm" link />
      <div className="min-w-0 flex-1">
        <Link href={p.href} className="flex items-center gap-1 truncate text-sm font-bold hover:underline">
          <span className="truncate">{p.name}</span>
          {p.verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verifiziert" />}
        </Link>
        {status && <p className={typing || p.online ? "text-xs text-success" : "text-xs text-muted-foreground"}>{status}</p>}
      </div>
      {meta.conversationId && (
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Chat-Optionen" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <MoreVertical className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={p.href}>
                <UserRound /> Profil ansehen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onFlag("pinned", !meta.pinned)}>
              {meta.pinned ? <PinOff /> : <Pin />} {meta.pinned ? "Lösen" : "Anpinnen"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onFlag("muted", !meta.muted)}>
              {meta.muted ? <Bell /> : <BellOff />} {meta.muted ? "Stummschaltung aufheben" : "Stummschalten"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onFlag("archived", !meta.archived)}>
              {meta.archived ? <ArchiveRestore /> : <Archive />} {meta.archived ? "Aus dem Archiv holen" : "Archivieren"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {meta.blockedByMe ? (
              <DropdownMenuItem onSelect={() => onUnblock()}>
                <Ban /> Blockierung aufheben
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmBlock(true)}>
                <Ban /> {p.name} blockieren
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => reportRef.current?.click(), 0)}>
              <Flag /> Melden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ReportDialog
        targetType={reportMessageId ? "message" : "profile"}
        targetId={reportMessageId ?? p.id}
        targetUserId={p.id}
        trigger={<button ref={reportRef} type="button" className="hidden" tabIndex={-1} aria-hidden />}
      />
      <Dialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{p.name} blockieren?</DialogTitle>
            <DialogDescription>Ihr könnt euch danach keine Nachrichten mehr schreiben. Der bisherige Verlauf bleibt für dich sichtbar. Du kannst die Blockierung jederzeit aufheben.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmBlock(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onBlock();
                setBusy(false);
                setConfirmBlock(false);
              }}
            >
              Blockieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
