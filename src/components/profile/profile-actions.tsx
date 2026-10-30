import Link from "next/link";
import { CalendarPlus, Flag as FlagIcon, Images, MessageCircle, MessageCircleOff, UserPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { ReportDialog } from "@/components/shared/report-dialog";
import { FollowButton } from "./profile-client";

type Props = {
  targetId: string;
  username: string;
  self: boolean;
  loggedIn: boolean;
  favorite: boolean;
  following: boolean;
  /** null = kein Nachrichten-Button */
  message: { allowed: boolean; reason: string | null } | null;
  bookHref?: string | null;
  provider?: boolean;
};

/** Aktionsleiste auf Profilseiten: Nachricht, Buchen, Merken, Folgen, Melden. */
export function ProfileActions({ targetId, username, self, loggedIn, favorite, following, message, bookHref, provider }: Props) {
  if (self) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" asChild>
          <Link href="/dashboard/profil">
            <UserPen /> Profil bearbeiten
          </Link>
        </Button>
        {provider ? (
          <Button size="sm" variant="secondary" asChild>
            <Link href="/dashboard/galerie">
              <Images /> Galerie
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="secondary" asChild>
            <Link href="/dashboard/sichtbarkeit">Sichtbarkeit</Link>
          </Button>
        )}
      </div>
    );
  }
  const chatHref = `/dashboard/nachrichten?mit=${encodeURIComponent(username)}`;
  const login = (next: string) => `/anmelden?next=${encodeURIComponent(next)}`;
  return (
    <div className="flex flex-col gap-2">
      <div className={bookHref ? "grid grid-cols-2 gap-2" : "flex flex-col"}>
        {message &&
          (message.allowed ? (
            <Button size="sm" asChild>
              <Link href={loggedIn ? chatHref : login(chatHref)}>
                <MessageCircle /> Nachricht schreiben
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled aria-describedby="connect-hint">
              <MessageCircleOff /> Nachricht
            </Button>
          ))}
        {bookHref && (
          <Button size="sm" variant={message?.allowed ? "secondary" : "default"} asChild>
            <Link href={loggedIn ? bookHref : login(bookHref)}>
              <CalendarPlus /> Termin buchen
            </Link>
          </Button>
        )}
      </div>
      {message && !message.allowed && message.reason && (
        <p id="connect-hint" className="text-center text-[11px] text-muted-foreground">
          {message.reason}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {loggedIn ? (
          <FavoriteButton
            targetId={targetId}
            initial={favorite}
            withLabel
            className="h-8 justify-center rounded-md border border-input px-2 text-xs font-semibold hover:bg-accent [&_svg]:size-4"
          />
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href={login(`/p/${username}`)}>Merken</Link>
          </Button>
        )}
        <FollowButton targetId={targetId} initial={following} loggedIn={loggedIn} />
        {loggedIn ? (
          <ReportDialog
            targetType="profile"
            targetId={targetId}
            targetUserId={targetId}
            trigger={
              <Button size="sm" variant="outline">
                <FlagIcon /> Melden
              </Button>
            }
          />
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href={login(`/p/${username}`)}>
              <FlagIcon /> Melden
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
