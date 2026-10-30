"use client";

import dynamic from "next/dynamic";

const Inner = dynamic(() => import("./club-map-inner"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-md bg-muted" />,
});

/** Karte (Leaflet + OpenStreetMap), nur im Browser geladen. */
export function ClubMap(props: { lat: number; lng: number; label: string }) {
  return <Inner {...props} />;
}
