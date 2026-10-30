"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

export default function ClubMapInner({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false} className="z-0 h-56 w-full rounded-md" attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <CircleMarker center={[lat, lng]} radius={10} pathOptions={{ color: "#d1202f", fillColor: "#d1202f", fillOpacity: 0.6, weight: 2 }}>
        <Tooltip direction="top" offset={[0, -8]}>
          {label}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
