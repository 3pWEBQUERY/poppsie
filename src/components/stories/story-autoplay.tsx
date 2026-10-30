"use client";

import { useState } from "react";
import { CirclePlay } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { StoryViewer, type StorySource } from "./story-viewer";

/** Öffnet eine Story (z. B. aus einem geteilten Link/Highlight) direkt im Viewer. */
export function StoryAutoplay({ source, viewerId, label }: { source: StorySource; viewerId: string; label: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-6 py-12 text-center">
      <UserAvatar user={source.author} link size="lg" ring="story" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button onClick={() => setOpen(true)}>
        <CirclePlay /> Story ansehen
      </Button>
      {open && <StoryViewer queue={[source]} viewerId={viewerId} onClose={() => setOpen(false)} />}
    </div>
  );
}
