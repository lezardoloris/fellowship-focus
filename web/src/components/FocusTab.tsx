"use client";

import { useCallback, useEffect, useState } from "react";
import { desktopBridge, type WeeklyStats } from "@/lib/desktop";
import { buildSoloWeeklyStats, saveSoloOkr } from "@/lib/soloStats";

const GITHUB_KEY = "ff-github-user";

const LEAGUE_STYLE: Record<string, { color: string; blurb: string }> = {
  Shire: { color: "#9ca3af", blurb: "Peaceful start — build the habit" },
  Rohan: { color: "#60a5fa", blurb: "Riders of focus — momentum building" },
  Gondor: { color: "#c084fc", blurb: "Steadfast — deep work is your default" },
  Mordor: { color: "#f97316", blurb: "Forged in fire — elite focus" },
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

type GitHubStats = {
  user: string;
  commits: number;
  activeDays: number;
  perDay: Record<string, number>;
  error?: string;
};

export function FocusTab() {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [source, setSource] = useState<"desktop" | "solo">("solo");

  const load = useCallback(async () => {
    await desktopBridge.ready();
    const desktop = await desktopBridge.getWeeklyStats();
    if (desktop) {
      setStats(desktop);
      setSource("desktop");
      return;
    }
    setStats(buildSoloWeeklyStats());
    setSource("solo");
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const saveOkr = useCallback(
    async (patch: Record<string, number>) => {
      if (source === "desktop") {
        const s = await desktopBridge.setOkr(patch);
        if (s) setStats(s);
        return;
      }
      const map: Record<string, string> = {
        focus_hours_target: "focus_hours_target",
        focus_score_target: "focus_score_target",
        revenue_target_eur: "revenue_target_eur",
        revenue_current_eur: "revenue_current_eur",
      };
      const soloPatch: Record<string, number> = {};
      for (const [k, v] of Object.entries(patch)) {
        const key = map[k];
        if (key) soloPatch[key] = v;
      }
      saveSoloOkr(soloPatch);
      setStats(buildSoloWeeklyStats());
    },
    [source]
  );

  const today = new Date().toISOString().slice(0, 10);

  if (!stats) {
    return <p className="animate-pulse text-sm text-white/50">Loading your week…</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-white/45">
        {source === "desktop"
          ? "Live from your desktop screen-time · no guild required"
          : "Solo tracking from your focus sessions · no guild required · desktop adds distraction scores"}
      </p>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <WeekPanel stats={stats} today={today} onSaveOkr={saveOkr} />
        </div>
        <div className="space-y-5">
          <LadderCard stats={stats} />
          <GitHubCard />
        </div>
      </div>
    </div>
  );
}

function WeekPanel({
  stats,
  today,
  onSaveOkr,
}: {
  stats: WeeklyStats;
  today: string;
  onSaveOkr: (patch: Record<string, number>) => void;
}) {
  const { days, kpis, okr } = stats;
  const maxMinutes = Math.max(30, ...days.map((d) => d.focus_minutes));

  const kpiCards = [
    { label: "Focus this week", value: `${kpis.focus_hours} h`, sub: `target ${okr.focus_hours.target} h` },
    { label: "Avg focus score", value: `${kpis.avg_focus_score}`, sub: "work vs distraction" },
    { label: "Streak", value: `${kpis.streak} d`, sub: `${kpis.focus_days} focus days` },
    { label: "Distraction", value: `${kpis.distraction_hours} h`, sub: "tracked this week" },
  ];

  return (
    <div className="glass-panel p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">This week</h2>
        <p className="mt-0.5 text-xs text-[#9ca3af]">
          Week of {rangeLabel(stats.weekStart)} · from your local screen-time data
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#f4f4f5]">{k.value}</p>
            <p className="mt-0.5 text-[11px] text-[#9ca3af]">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#9ca3af]">Focus calendar</p>
        <div className="flex items-end justify-between gap-2">
          {days.map((d) => {
            const h = Math.round((d.focus_minutes / maxMinutes) * 100);
            const isToday = d.date === today;
            const isFuture = d.date > today;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end justify-center">
                  <div
                    className={`w-7 rounded-t-md transition-all ${isFuture ? "bg-[#2e3134]" : "bg-[#b8422e]"}`}
                    style={{ height: `${Math.max(d.focus_minutes > 0 ? 6 : 2, h)}%` }}
                    title={`${d.focus_minutes} min focus`}
                  />
                </div>
                {d.focus_score > 0 ? (
                  <span className="text-[10px] font-semibold tabular-nums" style={{ color: scoreColor(d.focus_score) }}>
                    {d.focus_score}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#4b4f52]">·</span>
                )}
                <span className={`text-[11px] ${isToday ? "font-semibold text-[#f4f4f5]" : "text-[#9ca3af]"}`}>
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

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">OKR of the week</p>

        <OkrRow
          label="Focus hours"
          current={`${okr.focus_hours.current} h`}
          percent={pct(okr.focus_hours.current, okr.focus_hours.target)}
          editor={<TargetInput value={okr.focus_hours.target} suffix="h" onCommit={(v) => onSaveOkr({ focus_hours_target: v })} />}
        />
        <OkrRow
          label="Focus quality"
          current={`${okr.focus_score.current}`}
          percent={pct(okr.focus_score.current, okr.focus_score.target)}
          editor={<TargetInput value={okr.focus_score.target} onCommit={(v) => onSaveOkr({ focus_score_target: v })} />}
        />
        <RevenueRow okr={okr.revenue} onSave={onSaveOkr} />
      </div>
    </div>
  );
}

function LadderCard({ stats }: { stats: WeeklyStats }) {
  const { league, kpis, history } = stats;
  const style = LEAGUE_STYLE[league.name] ?? LEAGUE_STYLE.Shire;
  const maxMins = Math.max(60, ...history.map((h) => h.work_minutes));
  const toNext = league.next ? Math.max(0, league.next.at - league.hours) : 0;
  const nextPct = league.next ? pct(league.hours, league.next.at) : 100;

  return (
    <div className="glass-panel p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-white/50">Your ladder</p>
      <div className="mt-3 flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
          style={{ background: `${style.color}22`, color: style.color, border: `1px solid ${style.color}55` }}
        >
          {league.name[0]}
        </span>
        <div>
          <p className="text-lg font-semibold" style={{ color: style.color }}>{league.name}</p>
          <p className="text-[11px] text-[#9ca3af]">{style.blurb}</p>
        </div>
      </div>

      {league.next && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#9ca3af]">
            <span>To {league.next.name}</span>
            <span>{toNext.toFixed(1)} h to go</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${nextPct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Streak</p>
          <p className="mt-0.5 text-xl font-semibold">{kpis.streak} d</p>
        </div>
        <div className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">This week</p>
          <p className="mt-0.5 text-xl font-semibold">{league.hours} h</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">8-week history</p>
        <div className="flex items-end justify-between gap-1">
          {history.map((w, i) => {
            const hgt = Math.round((w.work_minutes / maxMins) * 100);
            const isLast = i === history.length - 1;
            return (
              <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end justify-center">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(w.work_minutes > 0 ? 6 : 2, hgt)}%`,
                      background: isLast ? "#b8422e" : "#4b4f52",
                    }}
                    title={`${(w.work_minutes / 60).toFixed(1)} h · score ${w.avg_focus_score}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GitHubCard() {
  const [user, setUser] = useState("");
  const [draft, setDraft] = useState("");
  const [data, setData] = useState<GitHubStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(GITHUB_KEY) || "" : "";
    setUser(saved);
    setDraft(saved);
  }, []);

  const fetchStats = useCallback(async (u: string) => {
    if (!u) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(u)}/events/public?per_page=100`);
      if (!res.ok) {
        setData({ user: u, commits: 0, activeDays: 0, perDay: {}, error: res.status === 404 ? "User not found" : "GitHub error" });
        return;
      }
      const events = (await res.json()) as Array<{ type: string; created_at: string; payload?: { size?: number; commits?: unknown[] } }>;
      const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
      const perDay: Record<string, number> = {};
      let commits = 0;
      for (const ev of events) {
        if (ev.type !== "PushEvent") continue;
        const t = new Date(ev.created_at).getTime();
        if (t < cutoff) continue;
        const n = ev.payload?.size ?? ev.payload?.commits?.length ?? 0;
        commits += n;
        const day = ev.created_at.slice(0, 10);
        perDay[day] = (perDay[day] || 0) + n;
      }
      setData({ user: u, commits, activeDays: Object.keys(perDay).length, perDay });
    } catch {
      setData({ user: u, commits: 0, activeDays: 0, perDay: {}, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchStats(user);
  }, [user, fetchStats]);

  const connect = () => {
    const u = draft.trim().replace(/^@/, "");
    localStorage.setItem(GITHUB_KEY, u);
    setUser(u);
  };

  return (
    <div className="glass-panel p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-white/50">GitHub activity</p>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="github username"
          className="input-premium flex-1 py-2 text-sm"
        />
        <button onClick={connect} className="btn-primary px-4 py-2 text-sm" disabled={loading}>
          {loading ? "…" : user ? "Refresh" : "Connect"}
        </button>
      </div>

      {data && !data.error && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Commits · 7d</p>
              <p className="mt-0.5 text-xl font-semibold">{data.commits}</p>
            </div>
            <div className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Active days</p>
              <p className="mt-0.5 text-xl font-semibold">{data.activeDays}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[#6b7075]">
            Public push events for <span className="text-[#9ca3af]">@{data.user}</span> — a shipping signal alongside focus.
          </p>
        </>
      )}

      {data?.error && <p className="mt-3 text-[11px] text-[#f87171]">{data.error}</p>}
      {!data && !user && (
        <p className="mt-3 text-[11px] text-[#6b7075]">
          Add your GitHub username to track commits shipped this week. Public activity only, no login.
        </p>
      )}
    </div>
  );
}

function RevenueRow({
  okr,
  onSave,
}: {
  okr: { current_eur: number; target_eur: number };
  onSave: (patch: Record<string, number>) => void;
}) {
  const [draft, setDraft] = useState(String(okr.current_eur));
  useEffect(() => setDraft(String(okr.current_eur)), [okr.current_eur]);
  return (
    <OkrRow
      label="Revenue (€)"
      current={`€${okr.current_eur}`}
      percent={pct(okr.current_eur, okr.target_eur)}
      editor={
        <div className="flex items-center gap-1 text-xs text-[#9ca3af]">
          <span>€</span>
          <input
            type="number"
            min={0}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onSave({ revenue_current_eur: Number(draft) || 0 })}
            className="input-premium w-20 py-1 text-center text-xs"
            title="Revenue booked this week"
          />
          <span>/</span>
          <TargetInput value={okr.target_eur} prefix="€" onCommit={(v) => onSave({ revenue_target_eur: v })} />
        </div>
      }
    />
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
