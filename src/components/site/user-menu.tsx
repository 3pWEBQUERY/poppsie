"use client";

import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, Settings, Shield, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { logout } from "@/app/(auth)/actions";
import type { UserSummary } from "@/lib/users/summary";

export function UserMenu({ user, role, accountType, logoutLabel }: { user: UserSummary; role: string; accountType: string; logoutLabel: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border bg-secondary py-1 pr-2 pl-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <UserAvatar user={user} size="xs" />
        <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          {accountType === "escort" ? "Escort-Konto" : accountType === "club" ? "Club / Studio" : "Mitglied"}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard /> Mein Bereich
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={user.href}>
            <UserRound /> Mein Profil ansehen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/einstellungen">
            <Settings /> Einstellungen
          </Link>
        </DropdownMenuItem>
        {(role === "admin" || role === "moderator") && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield /> Moderation
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
          <LogOut /> {logoutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
