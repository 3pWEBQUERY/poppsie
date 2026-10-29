import Link from "next/link";
import { cn, initials } from "@/lib/utils";

type AvatarUser = { name: string; avatarUrl: string | null; href?: string; online?: boolean };
type Anonymous = { anonymous: true; name: string; avatarUrl: string | null };

const SIZES = { xs: "size-7 text-[10px]", sm: "size-9 text-xs", md: "size-12 text-sm", lg: "size-20 text-lg", xl: "size-36 text-3xl" } as const;

/**
 * Avatar überall klickbar (→ öffentliches Profil). Inkognito-Nutzer erscheinen als Milchglas-Avatar:
 * Bild ist serverseitig verpixelt, zusätzlich Frosted-Overlay, kein Link, kein Name.
 * ring="story" zeigt den Story-Ring (aktive Story), ring="seen" einen gedämpften Ring.
 */
export function UserAvatar({
  user,
  size = "sm",
  ring,
  link = false,
  className,
}: {
  user: AvatarUser | Anonymous;
  size?: keyof typeof SIZES;
  ring?: "story" | "seen";
  link?: boolean;
  className?: string;
}) {
  const anonymous = "anonymous" in user;
  const inner = (
    <span
      className={cn(
        "relative inline-flex shrink-0 rounded-full",
        ring === "story" && "p-[2px] ring-2 ring-primary ring-offset-2 ring-offset-background",
        ring === "seen" && "p-[2px] ring-2 ring-border ring-offset-2 ring-offset-background",
        className,
      )}
    >
      <span className={cn("relative flex items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold", SIZES[size])}>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={anonymous ? "" : user.name} className="size-full object-cover" loading="lazy" draggable={false} />
        ) : (
          <span aria-hidden>{anonymous ? "?" : initials(user.name)}</span>
        )}
        {anonymous && <span aria-hidden className="frosted absolute inset-0" />}
      </span>
      {!anonymous && user.online && (
        <span aria-label="Online" className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-background bg-success" />
      )}
    </span>
  );
  if (link && !anonymous && user.href) {
    return (
      <Link href={user.href} aria-label={`Profil von ${user.name}`} className="inline-flex rounded-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
