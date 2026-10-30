"use client";

import { createContext, useContext } from "react";

export type ContentViewer = { id: string; username: string; name: string; avatarUrl: string | null; href: string; complete: boolean; staff: boolean } | null;

const Ctx = createContext<ContentViewer>(null);

/** Betrachter für das Content-Modul (Feed, Forum, Gruppen), einmal pro Seite gesetzt. */
export function ContentViewerProvider({ viewer, children }: { viewer: ContentViewer; children: React.ReactNode }) {
  return <Ctx.Provider value={viewer}>{children}</Ctx.Provider>;
}

export const useContentViewer = () => useContext(Ctx);
