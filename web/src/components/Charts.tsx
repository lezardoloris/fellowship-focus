"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * The chart layer. [UX-E6.5]
 *
 * The audit found the same bar chart hand-rolled five times with three
 * different max-scaling formulas (Focus tab day bars, Focus tab 8-week
 * history, Agenda day bars, Money day bars, Temptations heatmap) — none of
 * them with tooltips, axes, or empty states.
 *
 * These wrap Recharts but deliberately expose a tiny surface and read their
 * colours from the design tokens, so a chart can never drift from the rest of
 * the UI. Pass a token name (`accent`, `success`, `danger`, `warning`,
 * `muted`) rather than a hex.
 */

export type ChartTone = "accent" | "success" | "danger" | "warning" | "muted";

const TONE: Record<ChartTone, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  muted: "#2a2d31",
};

const AXIS_STYLE = {
  fontSize: 11,
  fill: "var(--text-faint)",
} as const;

/** Dark tooltip that matches .premium-panel instead of Recharts' white default. */
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
  formatter?: (value: number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="premium-panel px-3 py-2 text-xs">
      {label !== undefined && <p className="pp-faint">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="mt-0.5 font-semibold pp-strong">
          {formatter ? formatter(p.value ?? 0, p.name) : p.value}
        </p>
      ))}
    </div>
  );
}

type BarPoint = { label: string; value: number; /** optional second, "filled" portion */ accent?: number };

/**
 * The workhorse: a compact bar series. Replaces the five hand-rolled versions.
 *
 * `accent` renders a second bar stacked in front (e.g. billable minutes inside
 * total tracked minutes) — the Money view's "orange is paid time" pattern.
 */
export function BarSeries({
  data,
  height = 96,
  tone = "accent",
  baseTone = "muted",
  showAxis = false,
  showBaseline = true,
  showGrid = false,
  horizontal = false,
  highlightIndex,
  renderLabel,
  formatter,
  emptyLabel = "Nothing tracked yet.",
  minNonZero = 1,
}: {
  data: BarPoint[];
  height?: number;
  tone?: ChartTone;
  baseTone?: ChartTone;
  showAxis?: boolean;
  /** Ground line under the bars. Without it short bars appear to float. */
  showBaseline?: boolean;
  showGrid?: boolean;
  /** [HUD-H3] Rows instead of columns, labels on the left — the guild ladder.
      Negative values are allowed here (weekly net XP can dip below zero). */
  horizontal?: boolean;
  /** Tints one column — used for "today" in the Focus calendar. */
  highlightIndex?: number;
  /** Per-bar caption under the chart (the day's score, a weekday initial…).
      Added for [HUD-H0]: migrating the Focus calendar without it would have
      dropped the per-day score it prints under each column. */
  renderLabel?: (point: BarPoint, index: number) => ReactNode;
  formatter?: (value: number, name?: string) => string;
  emptyLabel?: ReactNode;
  /** [UX-5] One lonely bar (e.g. first week of 8-week history) looks like a
      bug. Require this many non-zero points before drawing. */
  minNonZero?: number;
}) {
  const nonZero = data.filter((d) => d.value !== 0 || (d.accent ?? 0) !== 0).length;
  if (nonZero < minNonZero) return <p className="py-4 text-sm pp-faint">{emptyLabel}</p>;
  const stacked = data.some((d) => d.accent !== undefined);
  const base = TONE[stacked ? baseTone : tone];
  const radius: [number, number, number, number] = horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0];

  // [UX-5] Bound the scale to visible data so the tallest bar fills most of
  // the plot (≥70%). Without this, a distant auto-max leaves bars crushed at
  // the bottom. Horizontal ladders keep auto-scale (negatives allowed).
  const peak = Math.max(
    0,
    ...data.map((d) => Math.max(Math.abs(d.value), Math.abs(d.accent ?? 0)))
  );
  const domainMax = peak > 0 ? peak / 0.7 : 1;

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            barCategoryGap="18%"
          >
            {showGrid && (
              <CartesianGrid
                vertical={horizontal}
                horizontal={!horizontal}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="2 4"
              />
            )}
            {horizontal ? (
              <>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="label"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_STYLE}
                  width={96}
                  interval={0}
                />
              </>
            ) : (
              <>
                {showAxis && <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_STYLE} />}
                <YAxis
                  hide={!showAxis}
                  domain={[0, domainMax]}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_STYLE}
                  width={showAxis ? 28 : 0}
                />
              </>
            )}
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={<ChartTooltip formatter={formatter} />}
            />
            {showBaseline &&
              (horizontal ? (
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.16)" />
              ) : (
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.16)" />
              ))}
            <Bar dataKey="value" radius={radius} fill={base} isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={base}
                  fillOpacity={highlightIndex === undefined || i === highlightIndex ? 1 : 0.72}
                />
              ))}
            </Bar>
            {stacked && (
              <Bar dataKey="accent" radius={radius} fill={TONE[tone]} isAnimationActive={false} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {renderLabel && !horizontal && (
        <div
          className="mt-1 grid gap-0 text-center"
          style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        >
          {data.map((d, i) => (
            <div key={i} className={i === highlightIndex ? "pp-strong" : "pp-faint"}>
              {renderLabel(d, i)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Per-bar colouring — used by the temptations heatmap (intensity by hour). */
export function HeatBars({
  data,
  height = 56,
  formatter,
  emptyLabel = "No hits yet.",
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  formatter?: (value: number, name?: string) => string;
  emptyLabel?: ReactNode;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.some((d) => d.value > 0)) {
    return <p className="py-4 text-sm pp-faint">{emptyLabel}</p>;
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="12%">
          {/* Hidden axis so the tooltip gets the hour label, not an index. */}
          <XAxis dataKey="label" hide />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            content={<ChartTooltip formatter={formatter} />}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.16)" />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={TONE.accent}
                fillOpacity={d.value ? 0.35 + (d.value / max) * 0.65 : 0.14}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny trend line for stat tiles — no axes, no chrome.
 *  [UX-4] Callers must pass height ≥ 40; below that a sparkline is noise. */
export function Sparkline({
  data,
  height = 40,
  tone = "accent",
}: {
  data: number[];
  height?: number;
  tone?: ChartTone;
}) {
  if (!data.some((v) => v > 0)) return null;
  // Bound Y so a single spike doesn't leave the rest as a flat line on the floor.
  const peak = Math.max(...data.map((v) => Math.abs(v)), 1);
  const points = data.map((value, i) => ({ i, value }));
  return (
    <div className="min-w-0 overflow-hidden" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={[0, peak / 0.7]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={TONE[tone]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Filled trend, for the week-over-week views. */
export function TrendArea({
  data,
  height = 120,
  tone = "accent",
  showAxis = true,
  formatter,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  tone?: ChartTone;
  showAxis?: boolean;
  formatter?: (value: number, name?: string) => string;
}) {
  if (!data.some((d) => d.value > 0)) {
    return <p className="py-4 text-sm pp-faint">Not enough history yet.</p>;
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`ff-area-${tone}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TONE[tone]} stopOpacity={0.5} />
              <stop offset="100%" stopColor={TONE[tone]} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          {showAxis && <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_STYLE} />}
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.15)" }}
            content={<ChartTooltip formatter={formatter} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={TONE[tone]}
            strokeWidth={2}
            fill={`url(#ff-area-${tone})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
