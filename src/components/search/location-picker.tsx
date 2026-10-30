"use client";

import { useState } from "react";
import { LocateFixed, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RADIUS } from "@/lib/search/filters";
import { Field, SingleSlider } from "./fields";
import { CITY_OPTIONS } from "./options";

export type LocationValue = { stadt: string | null; lat: number | null; lng: number | null; radius: number };

const CONSENT_KEY = "pp_geo_consent";

/** Standortwahl: Browser-Geolocation (mit Einwilligung) oder Stadt, dazu Umkreis 1–200 km. */
export function LocationPicker({ value, onChange }: { value: LocationValue; onChange: (v: Partial<LocationValue>) => void }) {
  const [ask, setAsk] = useState(false);
  const [locating, setLocating] = useState(false);
  const usingGeo = value.lat != null && value.lng != null && !value.stadt;

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Dein Browser unterstützt keine Standortabfrage");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ stadt: null, lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100 });
      },
      () => {
        setLocating(false);
        toast.error("Standort konnte nicht ermittelt werden. Wähle stattdessen eine Stadt.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const start = () => {
    let ok = false;
    try {
      ok = localStorage.getItem(CONSENT_KEY) === "1";
    } catch {}
    if (ok) locate();
    else setAsk(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label="Ort">
        {usingGeo ? (
          <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm">
            <LocateFixed className="size-4 text-primary" />
            <span className="flex-1 truncate">Mein Standort</span>
            <button type="button" aria-label="Standort entfernen" onClick={() => onChange({ lat: null, lng: null })} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Select
            options={CITY_OPTIONS}
            value={value.stadt}
            onChange={(stadt) => onChange({ stadt, lat: null, lng: null })}
            placeholder="Stadt wählen"
            searchable
            searchPlaceholder="Stadt suchen"
            clearable
            sheetTitle="Stadt"
            aria-label="Stadt"
          />
        )}
      </Field>
      {!usingGeo && (
        <Button type="button" variant="outline" size="sm" onClick={start} disabled={locating}>
          <MapPin /> {locating ? "Standort wird ermittelt …" : "Meinen Standort verwenden"}
        </Button>
      )}
      {(usingGeo || value.stadt) && (
        <SingleSlider
          label="Umkreis"
          min={RADIUS.min}
          max={RADIUS.max}
          value={value.radius}
          format={(n) => `${n} km`}
          onChange={(radius) => onChange({ radius })}
        />
      )}
      <Dialog open={ask} onOpenChange={setAsk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Standort verwenden?</DialogTitle>
            <DialogDescription>
              Wir nutzen deinen Standort nur für diese Suche, um Entfernungen zu berechnen. Er wird auf etwa 1 km gerundet und nicht gespeichert. Dein
              Browser fragt dich anschliessend noch einmal um Erlaubnis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAsk(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                try {
                  localStorage.setItem(CONSENT_KEY, "1");
                } catch {}
                setAsk(false);
                locate();
              }}
            >
              Standort freigeben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
