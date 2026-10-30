"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Dialog mit Pflicht-Begründung. Die Begründung wird der betroffenen Person mitgeteilt.
 * Zusatzfelder (z. B. Sperrdauer) kommen als children.
 */
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  minLength = 5,
  reasonLabel = "Begründung (wird der betroffenen Person mitgeteilt)",
  placeholder,
  defaultReason = "",
  onSubmit,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  minLength?: number;
  reasonLabel?: string;
  placeholder?: string;
  defaultReason?: string;
  onSubmit: (reason: string) => Promise<Result>;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(defaultReason);
  const [pending, start] = useTransition();
  const tooShort = reason.trim().length < minLength;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setReason(defaultReason);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (tooShort) return;
            start(async () => {
              const res = await onSubmit(reason.trim());
              if (res.ok) {
                setOpen(false);
                setReason(defaultReason);
              } else toast.error(res.error);
            });
          }}
        >
          {children}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">{reasonLabel}</Label>
            <Textarea id="reason" rows={4} required minLength={minLength} maxLength={2000} value={reason} placeholder={placeholder} onChange={(e) => setReason(e.target.value)} />
            {minLength > 0 && <p className="text-[11px] text-muted-foreground">Mindestens {minLength} Zeichen.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || tooShort}>
              {pending && <Loader2 className="animate-spin" />} {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
