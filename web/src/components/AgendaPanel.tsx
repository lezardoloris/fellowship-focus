"use client";

import { useCallback, useEffect, useState } from "react";
import { PremiumLoader } from "@/components/PremiumLoader";
import { WeeklyDigestPanel } from "@/components/WeeklyDigestPanel";
import { TemptationsPanel } from "@/components/TemptationsPanel";

type Day = {
  date: string;
  weekday: string;
  focus_minutes: number;
  sessions: number;
  work_seconds: number;
  distraction_seconds: number;
  focus_score: number;
};

type Productivity = {
  week_start: string;
  days: Day[];
  kpis: {
    focus_hours: number;
    focus_sessions: number;
    avg_focus_score: number;
    distraction_hours: number;
    streak: number;
    habit_rate: number;
  };
  okr: {
    focus_hours: { current: number; target: number };
    habit_rate: { current: number; target: number };
    revenue: { current_cents: number; target_cents: number };
  };
};

function scoreColor(score: number): string {
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#facc15";
  return "#f87171";
}

function pct(current: number, target: number): number {
  return target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
}

function rangeLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function AgendaPanel({ token }: { token: string }) {
  const [data, setData] = useState<Productivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revenueDraft, setRevenueDraft] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/productivity?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const json = (await res.json()) as Productivity;
        setData(json);
        setRevenueDraft(String(Math.round(json.okr.revenue.current_cents / 100)));
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const save = useCallback(
    async (patch: Record<string, number>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/productivity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, ...patch }),
        });
        if (res.ok) {
          const json = (await res.json()) as Productivity;
          setData(json);
        }
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return <PremiumLoader full className="min-h-[12vh]" size="sm" />;
  }
  if (!data) return null;

  const { days, kpis, okr } = data;
  const maxMinutes = Math.max(30, ...days.map((d) => d.focus_minutes));

  const kpiCards: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: "Focus this week",
      value: `${kpis.focus_hours} h`,
      sub: `target ${okr.focus_hours.target} h`,
    },
    { label: "Avg focus score", value: `${kpis.avg_focus_score}` , sub: "work vs distraction" },
    { label: "Streak", value: `${kpis.streak} d`, sub: `${kpis.focus_sessions} sessions` },
    { label: "Distraction", value: `${kpis.distraction_hours} h`, sub: "tracked this week" },
  ];

  return (
    <div className="glass-card p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Agenda &amp; OKR</h2>
          <p className="mt-0.5 text-xs text-[#9ca3af]">
            Week of {rangeLabel(data.week_start)} · progress updates from your focus data
            {saving ? " · saving…" : ""}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#f4f4f5]">{k.value}</p>
            {k.sub && <p className="mt-0.5 text-[11px] text-[#9ca3af]">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Weekly calendar */}
      <div className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#9ca3af]">
          Focus calendar
        </p>
        <div className="flex items-end justify-between gap-2">
          {days.map((d) => {
            const h = Math.round((d.focus_minutes / maxMinutes) * 100);
            const isToday = d.date === today;
            const isFuture = d.date > today;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end justify-center">
                  <div
                    className={`w-7 rounded-t-md transition-all ${
                      isFuture ? "bg-[#2e3134]" : "bg-[#b8422e]"
                    }`}
                    style={{ height: `${Math.max(d.focus_minutes > 0 ? 6 : 2, h)}%` }}
                    title={`${d.focus_minutes} min focus · ${d.sessions} sessions`}
                  />
                </div>
                {d.focus_score > 0 ? (
                  <span
                    className="text-[10px] font-semibold tabular-nums"
                    style={{ color: scoreColor(d.focus_score) }}
                    title="Focus score (work vs distraction)"
                  >
                    {d.focus_score}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#4b4f52]">·</span>
                )}
                <span
                  className={`text-[11px] ${
                    isToday ? "font-semibold text-[#f4f4f5]" : "text-[#9ca3af]"
                  }`}
                >
                  {d.weekday}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-[#9ca3af]">
          Bars = focus minutes · number = daily focus score (green ≥70, amber ≥40, red below).
        </p>
      </div>

      {/* OKRs */}
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">OKR of the week</p>

        <OkrRow
          label="Focus hours"
          current={`${okr.focus_hours.current} h`}
          percent={pct(okr.focus_hours.current, okr.focus_hours.target)}
          editor={
            <TargetInput
              value={okr.focus_hours.target}
              suffix="h"
              onCommit={(v) => save({ focus_hours_target: v })}
            />
          }
        />

        <OkrRow
          label="Habit completion"
          current={`${okr.habit_rate.current}%`}
          percent={pct(okr.habit_rate.current, okr.habit_rate.target)}
          editor={
            <TargetInput
              value={okr.habit_rate.target}
              suffix="%"
              onCommit={(v) => save({ habit_rate_target: v })}
            />
          }
        />

        <OkrRow
          label="Freelance revenue"
          current={`€${Math.round(okr.revenue.current_cents / 100)}`}
          percent={pct(okr.revenue.current_cents, okr.revenue.target_cents)}
          editor={
            <div className="flex items-center gap-1 text-xs text-[#9ca3af]">
              <span>€</span>
              <input
                type="number"
                min={0}
                value={revenueDraft}
                onChange={(e) => setRevenueDraft(e.target.value)}
                onBlur={() => save({ revenue_current_eur: Number(revenueDraft) || 0 })}
                className="input-premium w-20 py-1 text-center text-xs"
                title="Revenue booked this week (manual)"
              />
              <span>/</span>
              <TargetInput
                value={Math.round(okr.revenue.target_cents / 100)}
                prefix="€"
                onCommit={(v) => save({ revenue_target_eur: v })}
              />
            </div>
          }
        />
      </div>

      <WeeklyDigestPanel token={token} />
      <div className="mt-4">
        <TemptationsPanel token={token} />
      </div>
    </div>
  );
}

function OkrRow({
  label,
  current,
  percent,
  editor,
}: {
  label: string;
  current: string;
  percent: number;
  editor: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#f4f4f5]">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#9ca3af]">
            {current} <span className="text-[#6b7075]">({percent}%)</span>
          </span>
          {editor}
        </div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TargetInput({
  value,
  suffix,
  prefix,
  onCommit,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <span className="flex items-center gap-0.5 text-xs text-[#9ca3af]">
      {prefix && <span>{prefix}</span>}
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(Number(draft) || 0)}
        className="input-premium w-16 py-1 text-center text-xs"
        title="Target"
      />
      {suffix && <span>{suffix}</span>}
    </span>
  );
}
