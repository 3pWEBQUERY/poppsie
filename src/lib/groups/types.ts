export type GroupPrivacy = "public" | "private" | "secret";
export type GroupRoleName = "owner" | "admin" | "moderator" | "member";
export type MemberStatus = "active" | "pending" | "invited" | "banned";

export const PRIVACY_LABELS: Record<GroupPrivacy, string> = {
  public: "Öffentlich",
  private: "Privat",
  secret: "Geheim",
};

export const PRIVACY_HINTS: Record<GroupPrivacy, string> = {
  public: "Alle können Inhalte sehen und direkt beitreten.",
  private: "Alle sehen die Gruppe, Inhalte nur Mitglieder. Beitritt per Anfrage.",
  secret: "Nur Mitglieder sehen die Gruppe. Beitritt nur per Einladung, nicht in der Suche.",
};

export type GroupCardView = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  privacy: GroupPrivacy;
  memberCount: number;
  region: string | null;
  myStatus: MemberStatus | null;
  myRole: GroupRoleName | null;
};

export type GroupMemberView = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  href: string;
  verified: boolean;
  accountType: "member" | "escort" | "club";
  role: GroupRoleName;
  status: MemberStatus;
  since: string;
};
