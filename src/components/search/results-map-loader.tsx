"use client";

import dynamic from "next/dynamic";
import type { MapPointData } from "./results-map";

const ResultsMap = dynamic(() => import("./results-map"), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">Karte wird geladen …</div>,
});

export function ResultsMapLoader(props: { points: MapPointData[]; origin: { lat: number; lng: number } | null; radiusKm: number }) {
  return <ResultsMap {...props} />;
}
