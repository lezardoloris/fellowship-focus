"use client";

import { useCallback, useEffect, useState } from "react";
import { SkeletonPanel } from "@/components/Skeleton";

type Digest = {
  insights: string[];
  hours_delta: number;
  previous_focus_hours: number;
  top_temptations: Array<{ site: string; c: number }>;
  kpis: {
    focus_hours: number;
    avg_focus_score: number;
    streak: number;
  };
};

export function WeeklyDigestPanel({ token }: { token: string }) {
  const [data, setData] = useState<Digest | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/digest?token=${encodeURIComponent(token)}`);
    if (res.ok) setData((await res.json()) as Digest);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // [UX-E3.1] Same height as the loaded panel, so the 2-col grid never
  // collapses to 1 col and back (which also reflowed FocusScoreHero).
  if (!data) return <SkeletonPanel lines={4} minHeight={210} />;

  return (
    <div className="hud-panel p-5" data-augmented-ui="tl-clip br-clip both">
      <p className="pp-title">Weekly review</p>
      {/* [HUD-H2] Streak removed — StreakBadge at the top of Progress owns it
          (audit counted streak 4×; this was the 3rd remaining). */}
      <p className="mt-2.5 text-[15px] pp-body">
        <span className="pp-strong font-semibold">{data.kpis.focus_hours}h</span> focus · score{" "}
        <span className="pp-strong font-semibold">{data.kpis.avg_focus_score}</span>
        {data.previous_focus_hours > 0 && (
          <span className="pp-faint">
            {" "}
            ({data.hours_delta >= 0 ? "+" : ""}
            {data.hours_delta}h vs last week)
          </span>
        )}
      </p>
      {data.insights.length > 0 && (
        <ul className="mt-3.5 space-y-2 text-sm pp-muted">
          {data.insights.map((i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[#c4653a]">·</span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      )}
      {data.top_temptations.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[11px] uppercase tracking-wider pp-faint">Top temptations</p>
          <p className="mt-1.5 text-sm pp-muted">
            {data.top_temptations
              .slice(0, 3)
              .map((t) => `${t.site} (${t.c}×)`)
              .join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
