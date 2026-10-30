"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/shared/select/select";
import { setRole } from "@/lib/admin/actions/manage";

const OPTIONS = [
  { value: "user", label: "Benutzer", description: "Keine Team-Rechte" },
  { value: "moderator", label: "Moderator", description: "Meldungen, KYC, Einsprüche, Forum" },
  { value: "admin", label: "Admin", description: "Alles inkl. Rollenverwaltung" },
];

export function RoleSelect({ userId, role }: { userId: string; role: "user" | "moderator" | "admin" }) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label="Rolle"
      options={OPTIONS}
      value={value}
      disabled={pending}
      onChange={(v) => {
        if (!v || v === value) return;
        const next = v as typeof role;
        start(async () => {
          const res = await setRole({ userId, role: next });
          if (!res.ok) toast.error(res.error);
          else {
            setValue(next);
            toast.success("Rolle geändert");
            router.refresh();
          }
        });
      }}
    />
  );
}
