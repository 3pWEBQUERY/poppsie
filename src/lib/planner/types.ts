import { z } from "zod";

/** Planer-Aktionen und ihre Nutzdaten (rein, Client und Server). */
export const storyPayload = z.object({
  mediaId: z.uuid(),
  kind: z.enum(["image", "video"]).optional(),
  thumbUrl: z.string().max(2000).optional(),
  overlayText: z.string().trim().max(120).optional(),
});
export const locationPayload = z.object({ city: z.string().min(2).max(80) });
export const broadcastPayload = z.object({
  segment: z.enum(["followers", "favorites", "region"]),
  region: z.string().max(10).optional(),
  text: z.string().trim().min(3, "Bitte schreib eine Nachricht").max(1000),
});

export type StoryPayload = z.infer<typeof storyPayload>;
export type LocationPayload = z.infer<typeof locationPayload>;
export type BroadcastPayload = z.infer<typeof broadcastPayload>;
export type PlannerType = "story" | "location" | "broadcast";
export type PlannerStatus = "scheduled" | "running" | "done" | "failed" | "cancelled";

export type PlannerItem = {
  id: string;
  type: PlannerType;
  payload: Record<string, unknown>;
  runAt: string;
  timezone: string;
  status: PlannerStatus;
  attempts: number;
  lastError: string | null;
  executedAt: string | null;
  localDate: string;
  localMin: number;
};

export const TYPE_LABEL: Record<PlannerType, string> = { story: "Story", location: "Neuer Standort", broadcast: "Nachricht an Follower" };
export const STATUS_LABEL: Record<PlannerStatus, string> = { scheduled: "Geplant", running: "Wird ausgeführt", done: "Ausgeführt", failed: "Fehlgeschlagen", cancelled: "Abgebrochen" };
export const SEGMENT_LABEL: Record<BroadcastPayload["segment"], string> = { followers: "Alle Follower", favorites: "Mitglieder, die mich favorisiert haben", region: "Follower und Fans in einer Region" };

export const MAX_ATTEMPTS = 5;
