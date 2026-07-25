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
    <div className="premium-panel p-5">
      <p className="pp-title">Temptations</p>
      <p className="mt-2.5 text-sm pp-body">
        {data.top.length === 0
          ? "No block hits this week — clean."
          : data.top
              .slice(0, 3)
              .map((t) => `${t.site} (${t.c}×)`)
              .join(" · ")}
      </p>
      <div className="mt-4 flex h-12 items-end gap-0.5">
        {data.heatmap.map((h) => (
          <div
            key={h.hour}
            title={`${h.hour}:00 — ${h.count}`}
            className="flex-1 rounded-sm bg-[#c4653a]"
            style={{ height: `${Math.max(8, (h.count / max) * 100)}%`, opacity: h.count ? 1 : 0.18 }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] pp-faint">Heatmap by hour — when you crack most</p>
    </div>
  );
}
