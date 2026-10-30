"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setLocale } from "@/app/actions/site";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/config";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <Globe className="size-3.5" />
        <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() =>
              start(async () => {
                await setLocale(l);
                router.refresh();
              })
            }
            className={l === locale ? "font-semibold" : undefined}
          >
            {LOCALE_LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
