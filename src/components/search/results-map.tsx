"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import L from "leaflet";
import { BadgeCheck, Star } from "lucide-react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { ProfileCardData } from "@/components/shared/profile-card";

export type MapPointData = { id: string; lat: number; lng: number; card: ProfileCardData };

const SWISS_CENTER: [number, number] = [46.8, 8.23];

type Group = { key: string; lat: number; lng: number; cards: ProfileCardData[] };

function groupPoints(points: MapPointData[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of points) {
    const key = `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;
    const g = map.get(key) ?? { key, lat: p.lat, lng: p.lng, cards: [] };
    g.cards.push(p.card);
    map.set(key, g);
  }
  return [...map.values()];
}

function icon(count: number) {
  const size = count > 9 ? 38 : 32;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="width:${size}px;height:${size}px" class="flex items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-white">${count}</div>`,
  });
}

function FitBounds({ groups, origin, radiusKm }: { groups: Group[]; origin: { lat: number; lng: number } | null; radiusKm: number }) {
  const map = useMap();
  const key = groups.map((g) => g.key).join("|") + (origin ? `${origin.lat},${origin.lng},${radiusKm}` : "");
  useEffect(() => {
    if (origin) {
      map.fitBounds(L.latLng(origin.lat, origin.lng).toBounds(radiusKm * 2000), { padding: [20, 20], maxZoom: 13 });
    } else if (groups.length) {
      map.fitBounds(L.latLngBounds(groups.map((g) => [g.lat, g.lng])), { padding: [40, 40], maxZoom: 12 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function MiniCard({ c }: { c: ProfileCardData }) {
  return (
    <Link href={c.href} className="flex items-center gap-2.5 rounded-md p-1.5 text-foreground! no-underline hover:bg-secondary">
      {c.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.imageUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted font-bold text-muted-foreground">{c.name.slice(0, 1)}</span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-sm font-semibold">
          <span className="truncate">{c.name}</span>
          {c.age ? <span className="font-normal text-muted-foreground">{c.age}</span> : null}
          {c.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" />}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {c.subtitle ?? c.city}
          {c.distanceKm != null && ` · ${c.distanceKm < 1 ? "< 1" : Math.round(c.distanceKm)} km`}
        </span>
        {c.ratingCount ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-primary text-primary" /> {(c.ratingAvg ?? 0).toFixed(1)} ({c.ratingCount})
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** Kartenansicht der Suchergebnisse (OSM). Positionen sind serverseitig gerundet und gruppiert. */
export default function ResultsMap({ points, origin, radiusKm }: { points: MapPointData[]; origin: { lat: number; lng: number } | null; radiusKm: number }) {
  const groups = useMemo(() => groupPoints(points), [points]);
  return (
    <div
      className="h-[70vh] min-h-[420px] overflow-hidden rounded-lg border bg-muted [&_.leaflet-bar]:shadow-none! [&_.leaflet-bar]:border-border! [&_.leaflet-bar_a]:bg-popover! [&_.leaflet-bar_a]:text-foreground! [&_.leaflet-bar_a]:border-border! [&_.leaflet-container]:bg-muted! [&_.leaflet-container]:font-sans! [&_.leaflet-control-attribution]:bg-background/80! [&_.leaflet-control-attribution]:text-[10px]! [&_.leaflet-control-attribution]:text-muted-foreground! [&_.leaflet-control-attribution_a]:text-muted-foreground! [&_.leaflet-popup-content]:m-1.5! [&_.leaflet-popup-content-wrapper]:rounded-lg! [&_.leaflet-popup-content-wrapper]:border! [&_.leaflet-popup-content-wrapper]:bg-popover! [&_.leaflet-popup-content-wrapper]:text-foreground! [&_.leaflet-popup-content-wrapper]:shadow-none! [&_.leaflet-popup-tip]:bg-popover! [&_.leaflet-popup-tip]:shadow-none! [&_.leaflet-tile]:[filter:invert(1)_hue-rotate(180deg)_brightness(0.85)_contrast(0.9)]! [&_.leaflet-popup-close-button]:text-muted-foreground!"
    >
      <MapContainer center={origin ? [origin.lat, origin.lng] : SWISS_CENTER} zoom={origin ? 10 : 7} scrollWheelZoom className="size-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds groups={groups} origin={origin} radiusKm={radiusKm} />
        {origin && <Circle center={[origin.lat, origin.lng]} radius={radiusKm * 1000} pathOptions={{ color: "#d1202f", weight: 1, fillOpacity: 0.06 }} />}
        {groups.map((g) => (
          <Marker key={g.key} position={[g.lat, g.lng]} icon={icon(g.cards.length)}>
            <Popup minWidth={220} maxWidth={260}>
              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                {g.cards.map((c) => (
                  <MiniCard key={c.id} c={c} />
                ))}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
