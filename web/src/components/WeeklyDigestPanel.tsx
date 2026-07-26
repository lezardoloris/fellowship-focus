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

  // [UX-2]/[UX-3] Compact skeleton — items-start on the parent grid means we
  // no longer need to match the score tile's eventual height.
  if (!data) return <SkeletonPanel lines={3} minHeight={96} />;

  const empty = data.insights.length === 0 && data.kpis.focus_hours === 0;

  return (
    <div className="hud-panel p-5" data-augmented-ui="tl-clip br-clip both">
      <p className="pp-title">Weekly review</p>
      {/* [HUD-H2] Streak removed — StreakBadge at the top of Progress owns it
          (audit counted streak 4×; this was the 3rd remaining). */}
      {empty ? (
        <p className="mt-2 text-sm pp-faint">
          Finish a focus session — the review fills from your week.
        </p>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
