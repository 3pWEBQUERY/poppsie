"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/stats/queries";

/** Diagrammfarben: aktuelle Periode rot, Vorperiode neutral grau und gestrichelt (keine Verläufe, keine Schatten). */
export const CUR = "#e5484d";
export const PREV = "#8b929a";
const GRID = "#31363c";
const AXIS = "#9aa1a9";

type Fmt = (v: number) => string;
const fmtFor =
  (decimals: number, suffix: string): Fmt =>
  (v) =>
    `${new Intl.NumberFormat("de-CH", { maximumFractionDigits: decimals, minimumFractionDigits: decimals > 1 ? decimals : 0 }).format(v)}${suffix}`;

function TooltipBox({
  active,
  payload,
  label,
  fmt,
  prevLabel,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
  fmt: Fmt;
  prevLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const cur = payload.find((p) => p.dataKey === "value")?.value;
  const prev = payload.find((p) => p.dataKey === "prev")?.value;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs">
      <div className="mb-1 font-semibold">{label}</div>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: CUR }} />{" "}
        Aktuell{" "}
        <span className="ml-auto font-semibold tabular-nums">
          {cur !== undefined ? fmt(cur) : "–"}
        </span>
      </div>
      {prev !== undefined && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: PREV }} />{" "}
          {prevLabel} <span className="ml-auto tabular-nums">{fmt(prev)}</span>
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ prev = true }: { prev?: boolean }) {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded" style={{ background: CUR }} />{" "}
        Aktueller Zeitraum
      </span>
      {prev && (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-4 border-t-2 border-dashed"
            style={{ borderColor: PREV }}
          />{" "}
          Vorperiode
        </span>
      )}
    </div>
  );
}

/** Breite des Containers messen (Diagramme bekommen feste Pixelmasse). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Linie: aktueller Zeitraum vs. Vorperiode (gleiche Achse). */
export function TrendChart({
  data,
  decimals = 1,
  suffix = "",
  height = 200,
  comparison = true,
  domain,
  dots = false,
}: {
  data: SeriesPoint[];
  decimals?: number;
  suffix?: string;
  height?: number;
  comparison?: boolean;
  domain?: [number, number];
  dots?: boolean;
}) {
  const fmt = fmtFor(decimals, suffix);
  const [ref, width] = useWidth();
  return (
    <div ref={ref} style={{ height }} className="w-full">
      {width > 0 && (
        <LineChart
          width={width}
          height={height}
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={16}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            domain={domain ?? [0, "auto"]}
            width={44}
          />
          <Tooltip
            content={<TooltipBox fmt={fmt} prevLabel="Vorperiode" />}
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
          />
          {comparison && (
            <Line
              type="monotone"
              dataKey="prev"
              stroke={PREV}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={CUR}
            strokeWidth={2}
            dot={
              dots || data.length <= 14 ? { r: 4, fill: CUR, strokeWidth: 0 } : false
            }
            connectNulls
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#1d2024" }}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </div>
  );
}

/** Säulen: aktueller Zeitraum neben Vorperiode. */
export function CompareBars({
  data,
  height = 200,
}: {
  data: SeriesPoint[];
  height?: number;
}) {
  const fmt = fmtFor(0, "");
  const [ref, width] = useWidth();
  return (
    <div ref={ref} style={{ height }} className="w-full">
      {width > 0 && (
        <BarChart
          width={width}
          height={height}
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          barGap={2}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={16}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={44}
          />
          <Tooltip
            content={<TooltipBox fmt={fmt} prevLabel="Vorperiode" />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar
            dataKey="prev"
            fill={PREV}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            maxBarSize={14}
          />
          <Bar
            dataKey="value"
            fill={CUR}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            maxBarSize={14}
          />
        </BarChart>
      )}
    </div>
  );
}
