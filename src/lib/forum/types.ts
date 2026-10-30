import type { Author } from "@/lib/content/types";

export const THREAD_PREFIXES = ["Frage", "Erfahrung", "Info", "Tipp", "Warnung", "Diskussion", "Suche"] as const;
export type ThreadPrefix = (typeof THREAD_PREFIXES)[number];

export type ThreadSort = "aktivitaet" | "neu" | "top";
export const SORT_LABELS: Record<ThreadSort, string> = { aktivitaet: "Aktivität", neu: "Neueste", top: "Top" };

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  threadCount: number;
  lastActivity: string | null;
  children: CategoryNode[];
};

export type ThreadListItem = {
  id: string;
  title: string;
  prefix: string | null;
  tags: string[];
  pinned: boolean;
  locked: boolean;
  solved: boolean;
  replyCount: number;
  viewCount: number;
  lastPostAt: string;
  createdAt: string;
  category: { name: string; slug: string };
  author: Author;
  excerpt: string;
  thumbUrl: string | null;
  lastReply: { author: Author; at: string } | null;
  unread: boolean;
  hasPoll: boolean;
};

export type PollView = {
  id: string;
  question: string;
  multiple: boolean;
  closesAt: string | null;
  closed: boolean;
  total: number;
  voters: number;
  mine: string[];
  options: { id: string; label: string; votes: number }[];
};

export type RelatedThread = { id: string; title: string; replyCount: number; lastPostAt: string; category: string };
