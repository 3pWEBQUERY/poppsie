import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  KYC_LABEL,
  REASON_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  URGENT_REASONS,
  USER_STATUS_LABEL,
  type FlagReason,
  type FlagStatus,
} from "@/lib/admin/labels";
import { cn } from "@/lib/utils";

export function ReasonBadge({ reason, className }: { reason: FlagReason; className?: string }) {
  if (URGENT_REASONS.has(reason)) {
    return (
      <Badge className={cn("gap-1", className)}>
        <AlertTriangle /> {REASON_LABEL[reason]}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={className}>
      {REASON_LABEL[reason]}
    </Badge>
  );
}

export function FlagStatusBadge({ status }: { status: FlagStatus }) {
  const variant = status === "open" ? "warning" : status === "in_review" ? "outline" : status === "resolved" ? "success" : "muted";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

export function UserStatusBadge({ status, until }: { status: keyof typeof USER_STATUS_LABEL; until?: Date | null }) {
  const variant = status === "active" ? "success" : status === "suspended" ? "default" : "muted";
  return (
    <Badge variant={variant}>
      {USER_STATUS_LABEL[status]}
      {status === "suspended" && (until ? ` bis ${until.toLocaleDateString("de-CH")}` : " (permanent)")}
    </Badge>
  );
}

export function KycBadge({ status }: { status: keyof typeof KYC_LABEL }) {
  const variant = status === "verified" ? "success" : status === "pending" ? "warning" : status === "rejected" ? "default" : "muted";
  return <Badge variant={variant}>KYC: {KYC_LABEL[status]}</Badge>;
}

export function RoleBadge({ role }: { role: keyof typeof ROLE_LABEL }) {
  if (role === "user") return null;
  return <Badge variant="outline">{ROLE_LABEL[role]}</Badge>;
}

/** Abschnitt mit Titel im Admin-Bereich. */
export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          {title && <h2 className="text-sm font-bold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageTitle({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
