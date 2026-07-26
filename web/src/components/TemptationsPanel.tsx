"use client";

import { useEffect, useState } from "react";
import { HeatBars } from "@/components/Charts";
import { EmptyState } from "@/components/Panel";

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

  const heat = data.heatmap.map((h) => ({
    label: `${h.hour}:00`,
    value: h.count,
  }));
  const hasHeat = heat.some((h) => h.value > 0);

  return (
    <div className="hud-panel p-5" data-augmented-ui="tl-clip br-clip both">
      <p className="pp-title">Temptations</p>
      <p className="mt-2.5 text-sm pp-body">
        {data.top.length === 0
          ? "No block hits this week, clean."
          : data.top
              .slice(0, 3)
              .map((t) => `${t.site} (${t.c}×)`)
              .join(" · ")}
      </p>
      {/* [HUD-H2] Was hand-rolled divs with a home-grown max-scale. HeatBars
          owns intensity (opacity) and the tooltip (hour + count). */}
      {hasHeat ? (
        <div className="mt-4">
          <HeatBars
            data={heat}
            height={56}
            formatter={(v) => `${v} hit${v === 1 ? "" : "s"}`}
          />
        </div>
      ) : (
        <EmptyState>No hourly hits yet. The heatmap fills as blocks get hit.</EmptyState>
      )}
      <p className="mt-1.5 text-[11px] pp-faint">Heatmap by hour, when you crack most</p>
    </div>
  );
}
