"use client";

import { useCallback, useEffect, useState } from "react";

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

  if (!data) return null;

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#c4653a]">Weekly review</p>
      <p className="mt-2 text-sm text-white/70">
        {data.kpis.focus_hours}h focus · score {data.kpis.avg_focus_score} · 🔥 {data.kpis.streak}
        {data.previous_focus_hours > 0 && (
          <span className="text-white/40">
            {" "}
            ({data.hours_delta >= 0 ? "+" : ""}
            {data.hours_delta}h vs last week)
          </span>
        )}
      </p>
      {data.insights.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm text-white/60">
          {data.insights.map((i) => (
            <li key={i}>· {i}</li>
          ))}
        </ul>
      )}
      {data.top_temptations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-white/35">Top temptations</p>
          <p className="mt-1 text-sm text-white/55">
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
