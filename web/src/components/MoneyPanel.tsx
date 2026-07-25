"use client";

import { useCallback, useEffect, useState } from "react";
import { SkeletonTiles } from "@/components/Skeleton";
import { StatTile, ErrorState } from "@/components/Panel";
import { BarSeries } from "@/components/Charts";

type MoneyRow = {
  key: string;
  label: string;
  kind: "client" | "class";
  minutes: number;
  value_cents: number;
  effective_rate_cents: number;
  currency: string;
  source_minutes: { session: number; rule: number };
};

type ProfitRow = {
  project_id: string;
  name: string;
  client: string | null;
  currency: string;
  estimate_minutes: number;
  actual_minutes: number;
  over_budget: boolean;
  effective_rate_cents: number;
};

type Money = {
  from: string;
  to: string;
  tracked_minutes: number;
  billable_minutes: number;
  billable_pct: number;
  total_cents: number;
  effective_rate_cents: number;
  currency: string;
  rows: MoneyRow[];
  days: Array<{ date: string; value_cents: number; billable_minutes: number; tracked_minutes: number }>;
  prev: { total_cents: number; billable_pct: number; effective_rate_cents: number; tracked_minutes: number };
  profitability: ProfitRow[];
};

type Win = "week" | "month";

const eur = (cents: number, cur = "EUR") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
    cents / 100
  );
const hrs = (min: number) => (min / 60).toFixed(min >= 570 ? 0 : 1) + "h";

function Delta({ now, prev, money, cur }: { now: number; prev: number; money?: boolean; cur?: string }) {
  if (!prev) return null;
  const d = now - prev;
  if (d === 0) return <span className="pp-faint text-xs">= prev</span>;
  const up = d > 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-success" : "text-danger"}`}>
      {up ? "+" : ""}
      {money ? eur(d, cur) : d}
      {money ? "" : " pts"} vs prev
    </span>
  );
}

export function MoneyPanel({ token }: { token: string }) {
  const [win, setWin] = useState<Win>("week");
  const [data, setData] = useState<Money | null>(null);

  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/money?token=${encodeURIComponent(token)}&window=${win}`);
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as Money);
      setFailed(false);
    } catch {
      // [UX-E3.2] A failed fetch used to leave a permanently missing panel.
      setFailed(true);
    }
  }, [token, win]);

  useEffect(() => {
    load();
  }, [load]);

  if (failed && !data) return <ErrorState onRetry={load}>Couldn&apos;t load your money view.</ErrorState>;
  // [UX-E3.1] Reserve the height while loading — this panel is ~380px and used
  // to pop into the layout, shoving everything below it down.
  if (!data) return <SkeletonTiles count={4} minHeight={380} />;
  const cur = data.currency;
  const overProjects = data.profitability.filter((p) => p.over_budget);

  return (
    <div className="premium-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="pp-title">What makes me money</p>
        <div className="flex gap-1 text-xs">
          {(["week", "month"] as Win[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWin(w)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                win === w ? "bg-[#b8422e] text-white" : "pp-muted hover:bg-white/10 hover:text-white"
              }`}
            >
              {w === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {/* Headline tiles — everything in euros, never raw minutes alone */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="earned"
          value={eur(data.total_cents, cur)}
          sub={<Delta now={data.total_cents} prev={data.prev.total_cents} money cur={cur} />}
        />
        <StatTile
          label="effective rate"
          value={
            <>
              {eur(data.effective_rate_cents, cur)}
              <span className="text-sm font-normal pp-muted">/h</span>
            </>
          }
        />
        <StatTile label="tracked" value={hrs(data.tracked_minutes)} />
        <StatTile
          label="billable"
          value={`${data.billable_pct}%`}
          sub={<Delta now={data.billable_pct} prev={data.prev.billable_pct} />}
        />
      </div>

      {/* Day bars — billable (accent) inside total tracked (grey), per day.
          [UX-E6.5] Was hand-rolled divs with their own scaling maths and only a
          title= tooltip; now the shared chart layer, with a real tooltip. */}
      {data.days.length > 0 && (
        <div className="mt-4">
          <BarSeries
            height={92}
            data={data.days.map((d) => ({
              label: new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
              }),
              value: d.tracked_minutes,
              accent: d.billable_minutes,
            }))}
            formatter={(v) => `${(v / 60).toFixed(1)}h`}
            emptyLabel="No tracked time in this window yet."
          />
          <p className="mt-1 text-[11px] pp-faint">
            Each bar is a day — orange is paid time, grey is everything else.
          </p>
        </div>
      )}

      {/* The channels table — ranked by euros */}
      <ul className="mt-4 space-y-1.5 text-sm">
        {data.rows.length === 0 && (
          <li className="pp-faint">No tracked time yet in this window.</li>
        )}
        {data.rows.map((r) => (
          <li key={r.key} className="flex items-baseline justify-between gap-3">
            <span className={r.kind === "client" ? "pp-body" : "pp-faint"}>
              {r.label}
              {r.source_minutes.rule > 0 && (
                <span className="pp-faint text-[11px]"> · {hrs(r.source_minutes.rule)} via rules</span>
              )}
            </span>
            <span className="flex-none tabular-nums">
              <span className="pp-muted">{hrs(r.minutes)}</span>
              <span className={`ml-3 font-semibold ${r.value_cents > 0 ? "pp-strong" : "pp-faint"}`}>
                {eur(r.value_cents, r.currency)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {/* Estimate burn — projects eating the margin */}
      {overProjects.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[11px] uppercase tracking-wider pp-faint">Eating your margin</p>
          <ul className="mt-2 space-y-2 text-sm">
            {overProjects.map((p) => {
              const burn = Math.min(
                100,
                p.estimate_minutes ? (p.actual_minutes / p.estimate_minutes) * 100 : 100
              );
              return (
                <li key={p.project_id}>
                  <div className="flex justify-between">
                    <span className="pp-body">
                      {p.name}
                      {p.client && <span className="pp-faint"> · {p.client}</span>}
                    </span>
                    <span className="text-xs text-danger">
                      eff. {eur(p.effective_rate_cents, p.currency)}/h
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-danger"
                      style={{ width: `${burn}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
