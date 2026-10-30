import type { ClubFieldDef } from "@/db/schema";
import type { Check } from "@/lib/profile/completeness";
import type { AccountType, StepKey } from "./steps";

/** Kompatibel mit UploadedMedia aus dem MediaUploader. */
export type MediaItem = {
  id: string;
  kind: "image" | "video" | "audio" | "file";
  thumbUrl: string;
  url: string;
  fileName?: string | null;
  blurForGuests?: boolean;
};

export type MediaValues = { avatar: MediaItem | null; cover: MediaItem | null; gallery: MediaItem[]; blurForGuests: boolean };

export type ProfileStatus = { percent: number; complete: boolean; nextStep: string | null; checks: Check[] };

export type StepValues = Record<string, unknown>;

export type ProfileDraft = {
  accountType: AccountType;
  username: string;
  kycStatus: "none" | "pending" | "verified" | "rejected";
  clubType: string | null;
  clubTypeLabel: string | null;
  clubFields: ClubFieldDef[];
  values: Partial<Record<StepKey, StepValues>>;
  status: ProfileStatus;
};

export type SaveResult = { saved: boolean; errors: Record<string, string>; status: ProfileStatus | null };
