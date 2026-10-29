"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BookingView } from "@/lib/bookings/types";
import { BookingCard } from "./booking-card";

/** Anfragen / Bevorstehend / Vergangen mit Buchungskarten. */
export function BookingLists({
  groups,
  viewerId,
  focusId,
}: {
  groups: { requests: BookingView[]; upcoming: BookingView[]; past: BookingView[] };
  viewerId: string;
  focusId?: string;
}) {
  const router = useRouter();
  const initial = focusId
    ? groups.requests.some((b) => b.id === focusId)
      ? "requests"
      : groups.upcoming.some((b) => b.id === focusId)
        ? "upcoming"
        : "past"
    : groups.requests.length
      ? "requests"
      : "upcoming";

  // Neue Buchungen oder Statuswechsel verschieben Karten zwischen den Listen
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onEvent = (e: Event) => {
      const ev = (e as CustomEvent).detail as { type?: string };
      if (ev?.type !== "booking.updated") return;
      clearTimeout(t);
      t = setTimeout(() => router.refresh(), 800);
    };
    window.addEventListener("pp:realtime", onEvent);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pp:realtime", onEvent);
    };
  }, [router]);

  useEffect(() => {
    if (focusId) document.getElementById(`buchung-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [focusId]);

  const list = (items: BookingView[], empty: string) =>
    items.length === 0 ? (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
    ) : (
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((b) => (
          <div key={b.id} id={`buchung-${b.id}`} className="scroll-mt-24">
            <BookingCard booking={b} viewerId={viewerId} className={b.id === focusId ? "max-w-none border-primary" : "max-w-none"} />
          </div>
        ))}
      </div>
    );

  return (
    <Tabs defaultValue={initial}>
      <TabsList>
        <TabsTrigger value="requests">Anfragen ({groups.requests.length})</TabsTrigger>
        <TabsTrigger value="upcoming">Bevorstehend ({groups.upcoming.length})</TabsTrigger>
        <TabsTrigger value="past">Vergangen ({groups.past.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="requests" className="mt-3">
        {list(groups.requests, "Keine offenen Anfragen.")}
      </TabsContent>
      <TabsContent value="upcoming" className="mt-3">
        {list(groups.upcoming, "Keine bevorstehenden Termine.")}
      </TabsContent>
      <TabsContent value="past" className="mt-3">
        {list(groups.past, "Noch keine vergangenen Termine.")}
      </TabsContent>
    </Tabs>
  );
}
