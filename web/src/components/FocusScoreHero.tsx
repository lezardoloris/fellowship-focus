"use client";

import { useEffect, useState } from "react";
import { SkeletonPanel } from "@/components/Skeleton";
import { Sparkline } from "@/components/Charts";

type Hero = {
  today: number;
  yesterday: number;
  delta: number;
  breakdown: Array<{ level: string; seconds: number; weight: number; label: string }>;
  top_apps: Array<{ name: string; seconds: number; category?: string }>;
  best_hour: number | null;
  formula: string;
};

export function FocusScoreHero({
  token,
  sparkline,
}: {
  token: string | null;
  /** [HUD-H2] Week of daily scores — fills the empty band under the 52px numeral. */
  sparkline?: number[];
}) {
  const [data, setData] = useState<Hero | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/focus-score?token=${encodeURIComponent(token)}`);
      if (res.ok && !cancelled) setData((await res.json()) as Hero);
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  if (!token) return null;
  // [UX-E3.1] Don't render a fake 0 that then jumps to the real score.
  // [UX-2] Compact skeleton — no reserved 140px band that reads as empty panel.
  if (!data) return <SkeletonPanel lines={2} minHeight={88} />;
  const score = data?.today ?? 0;
  const delta = data?.delta ?? 0;
  const deltaLabel = delta === 0 ? "same as yesterday" : delta > 0 ? `+${delta} vs yesterday` : `${delta} vs yesterday`;

  return (
    <div className="hud-panel p-5" data-augmented-ui="tl-clip br-clip both">
      <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
        <p className="pp-title">Focus score</p>
        <div className="mt-1.5 flex items-baseline gap-3">
          <span className="hud-num text-5xl font-bold pp-strong">{score}</span>
          <span className={`text-sm font-medium ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-[#e08a6a]" : "pp-muted"}`}>
            {deltaLabel}
          </span>
        </div>
        {/* [UX-4] Trend is the subject here — keep sparkline at ≥40px, clipped. */}
        {sparkline && sparkline.some((v) => v > 0) ? (
          <div className="mt-3 max-w-[240px] overflow-hidden">
            <Sparkline data={sparkline} height={40} tone="accent" />
          </div>
        ) : (
          <p className="mt-2 text-xs pp-faint">
            Finish a few sessions and the week&apos;s trend appears here.
          </p>
        )}
        {data?.best_hour != null && (
          <p className="mt-1.5 text-xs pp-faint">Best hour around {data.best_hour}:00</p>
        )}
      </button>
      {open && data && (
        <div className="mt-4 border-t border-white/10 pt-3.5 text-sm pp-muted">
          <p className="text-xs pp-faint">{data.formula}</p>
          <ul className="mt-2.5 space-y-1.5">
            {data.breakdown.map((b) => (
              <li key={b.level} className="flex justify-between">
                <span className="pp-body">
                  {b.label} × {b.weight}
                </span>
                <span className="tabular-nums pp-muted">{Math.round(b.seconds / 60)} min</span>
              </li>
            ))}
          </ul>
          {data.top_apps.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wide pp-faint">Top apps</p>
              <ul className="mt-1.5 space-y-1.5">
                {data.top_apps.slice(0, 5).map((a) => (
                  <li key={a.name} className="flex justify-between">
                    <span className="truncate pp-body">{a.name}</span>
                    <span className="tabular-nums pp-muted">{Math.round(a.seconds / 60)}m</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
