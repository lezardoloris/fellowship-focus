"use client";

import { useEffect, useState } from "react";

type Hero = {
  today: number;
  yesterday: number;
  delta: number;
  breakdown: Array<{ level: string; seconds: number; weight: number; label: string }>;
  top_apps: Array<{ name: string; seconds: number; category?: string }>;
  best_hour: number | null;
  formula: string;
};

export function FocusScoreHero({ token }: { token: string | null }) {
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
  const score = data?.today ?? 0;
  const delta = data?.delta ?? 0;
  const deltaLabel = delta === 0 ? "same as yesterday" : delta > 0 ? `+${delta} vs yesterday` : `${delta} vs yesterday`;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">Focus score</p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-4xl font-semibold tabular-nums text-white">{score}</span>
          <span className={`text-sm ${delta >= 0 ? "text-emerald-400" : "text-white/45"}`}>
            {deltaLabel}
          </span>
        </div>
        {data?.best_hour != null && (
          <p className="mt-1 text-xs text-white/40">Best hour around {data.best_hour}:00</p>
        )}
      </button>
      {open && data && (
        <div className="mt-3 border-t border-white/10 pt-3 text-sm text-white/60">
          <p className="text-xs text-white/40">{data.formula}</p>
          <ul className="mt-2 space-y-1">
            {data.breakdown.map((b) => (
              <li key={b.level} className="flex justify-between">
                <span>
                  {b.label} × {b.weight}
                </span>
                <span>{Math.round(b.seconds / 60)} min</span>
              </li>
            ))}
          </ul>
          {data.top_apps.length > 0 && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-white/35">Top apps</p>
              <ul className="mt-1 space-y-1">
                {data.top_apps.slice(0, 5).map((a) => (
                  <li key={a.name} className="flex justify-between">
                    <span className="truncate">{a.name}</span>
                    <span>{Math.round(a.seconds / 60)}m</span>
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
