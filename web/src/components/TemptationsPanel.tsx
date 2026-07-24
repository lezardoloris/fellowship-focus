"use client";

import { useEffect, useState } from "react";

type Stats = {
  top: Array<{ site: string; c: number }>;
  heatmap: Array<{ hour: number; count: number }>;
};

export function TemptationsPanel({ token }: { token: string }) {
  const [data, setData] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`/api/temptations?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setData(j as Stats));
  }, [token]);

  if (!data) return null;
  const max = Math.max(1, ...data.heatmap.map((h) => h.count));

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#c4653a]">Temptations</p>
      <p className="mt-2 text-sm text-white/60">
        {data.top.length === 0
          ? "No block hits this week — clean."
          : data.top
              .slice(0, 3)
              .map((t) => `${t.site} (${t.c}×)`)
              .join(" · ")}
      </p>
      <div className="mt-3 flex h-10 items-end gap-0.5">
        {data.heatmap.map((h) => (
          <div
            key={h.hour}
            title={`${h.hour}:00 — ${h.count}`}
            className="flex-1 rounded-sm bg-[#c4653a]/70"
            style={{ height: `${Math.max(8, (h.count / max) * 100)}%`, opacity: h.count ? 1 : 0.15 }}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-white/30">Heatmap by hour — when you crack most</p>
    </div>
  );
}
