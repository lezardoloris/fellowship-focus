"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { HabitTracker } from "@/components/HabitTracker";
import { desktopBridge, type WeeklyStats } from "@/lib/desktop";
import { parseGithubUsername } from "@/lib/githubActivity";
import { buildSoloWeeklyStats, saveSoloOkr } from "@/lib/soloStats";

const GITHUB_KEY = "ff-github-user";

const LEAGUE_STYLE: Record<string, { color: string; blurb: string }> = {
  Shire: { color: "#9ca3af", blurb: "Peaceful start — build the habit" },
  Rohan: { color: "#60a5fa", blurb: "Riders of focus — momentum building" },
  Gondor: { color: "#d4a574", blurb: "Steadfast — deep work is your default" },
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
  avatarUrl: string | null;
  commits: number;
  prs: number;
  reviews: number;
  issues: number;
  repos: number;
  activeDays: number;
  perDay: Record<string, number>;
  topRepos: string[];
  privateIncluded: boolean;
  error?: string;
};

type FocusTabProps = {
  token?: string | null;
  fellowshipCode?: string | null;
};

export function FocusTab({ token = null, fellowshipCode = null }: FocusTabProps) {
  const [stats, setStats] = useState<WeeklyStats>(() => buildSoloWeeklyStats());
  const [source, setSource] = useState<"desktop" | "solo">("solo");

  const load = useCallback(async () => {
    // Never block the UI on the desktop bridge — solo dashboard is always ready.
    if (desktopBridge.present()) {
      const desktop = await desktopBridge.getWeeklyStats();
      if (desktop) {
        setStats(desktop);
        setSource("desktop");
        return;
      }
    }
    setStats(buildSoloWeeklyStats());
    setSource("solo");
  }, []);

  useEffect(() => {
    load();
    // If bridge appears a moment later, upgrade to desktop stats once.
    let cancelled = false;
    desktopBridge.ready().then(async () => {
      if (cancelled || !desktopBridge.present()) return;
      const desktop = await desktopBridge.getWeeklyStats();
      if (!cancelled && desktop) {
        setStats(desktop);
        setSource("desktop");
      }
    });
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load]);

  const saveOkr = useCallback(
    async (patch: Record<string, number>) => {
      if (source === "desktop") {
        const s = await desktopBridge.setOkr(patch);
        if (s) {
          setStats(s);
          return;
        }
      }
      const soloPatch: Record<string, number> = {};
      if (patch.focus_hours_target != null) soloPatch.focus_hours_target = patch.focus_hours_target;
      if (patch.focus_score_target != null) soloPatch.focus_score_target = patch.focus_score_target;
      if (patch.revenue_target_eur != null) soloPatch.revenue_target_eur = patch.revenue_target_eur;
      if (patch.revenue_current_eur != null) soloPatch.revenue_current_eur = patch.revenue_current_eur;
      saveSoloOkr(soloPatch);
      setStats(buildSoloWeeklyStats());
      setSource("solo");
    },
    [source]
  );

  const today = new Date().toISOString().slice(0, 10);
  const empty = stats.kpis.focus_hours === 0 && stats.kpis.streak === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Your week</h1>
          <p className="mt-1 text-xs text-white/70">
            Ladder · habit calendar · OKRs
            {fellowshipCode ? " · synced with guild when connected" : " — works solo"}.{" "}
            {source === "desktop" ? "Desktop screen-time live." : "Filled by timers you finish on Block."}
          </p>
        </div>
      </div>

      {empty && (
        <div className="glass-panel border border-[#b8422e]/40 px-5 py-4 text-sm text-white/80">
          Focus week is empty until you complete a session. Go to{" "}
          <span className="font-semibold text-white">Block → Start the timer</span>, finish a cycle —
          it lands here automatically (streak + ladder XP). Habit check-ins still work below.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <WeekPanel stats={stats} today={today} onSaveOkr={saveOkr} />
        <div className="space-y-5">
          <LadderCard stats={stats} />
          <GitHubCard />
        </div>
      </div>

      <div className="glass-panel p-6">
        <HabitTracker token={token} fellowshipCode={fellowshipCode} />
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
        <h2 className="text-lg font-semibold text-white">Week overview</h2>
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
      <p className="text-xs font-medium uppercase tracking-wider text-white/70">Your ladder</p>
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
  const [oauthLogin, setOauthLogin] = useState<string | null>(null);
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const savedRaw = typeof window !== "undefined" ? localStorage.getItem(GITHUB_KEY) || "" : "";
    const saved = parseGithubUsername(savedRaw) || "";
    if (saved && saved !== savedRaw) localStorage.setItem(GITHUB_KEY, saved);
    setUser(saved);
    setDraft(saved);
    fetch("/api/auth/providers-status")
      .then((r) => r.json())
      .then((j) => setOauthAvailable(Boolean(j.github)))
      .catch(() => setOauthAvailable(false));
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        const login = s?.user?.githubLogin as string | undefined;
        if (login) {
          setOauthLogin(login);
          if (!saved) {
            setUser(login);
            setDraft(login);
            localStorage.setItem(GITHUB_KEY, login);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchStats = useCallback(async (u: string) => {
    if (!u) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/github/activity?user=${encodeURIComponent(u)}`);
      const json = await res.json();
      if (!res.ok) {
        setData({
          user: u,
          avatarUrl: null,
          commits: 0,
          prs: 0,
          reviews: 0,
          issues: 0,
          repos: 0,
          activeDays: 0,
          perDay: {},
          topRepos: [],
          privateIncluded: false,
          error: json.error || "GitHub error",
        });
        return;
      }
      setData(json as GitHubStats);
      if (json.user && json.user !== u) {
        localStorage.setItem(GITHUB_KEY, json.user);
        setUser(json.user);
        setDraft(json.user);
      }
    } catch {
      setData({
        user: u,
        avatarUrl: null,
        commits: 0,
        prs: 0,
        reviews: 0,
        issues: 0,
        repos: 0,
        activeDays: 0,
        perDay: {},
        topRepos: [],
        privateIncluded: false,
        error: "Network error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchStats(user);
  }, [user, fetchStats]);

  const connect = () => {
    const u = parseGithubUsername(draft);
    if (!u) {
      setData({
        user: draft,
        avatarUrl: null,
        commits: 0,
        prs: 0,
        reviews: 0,
        issues: 0,
        repos: 0,
        activeDays: 0,
        perDay: {},
        topRepos: [],
        privateIncluded: false,
        error: "Enter a username or github.com URL",
      });
      return;
    }
    localStorage.setItem(GITHUB_KEY, u);
    setUser(u);
    setDraft(u);
  };

  async function connectOauth() {
    setAuthBusy(true);
    try {
      await signIn("github", { callbackUrl: "/app?tab=focus" });
    } finally {
      setAuthBusy(false);
    }
  }

  function clearTracking() {
    localStorage.removeItem(GITHUB_KEY);
    setUser("");
    setDraft("");
    setData(null);
  }

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-white/70">GitHub coding</p>
        {data?.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
        )}
      </div>

      {oauthAvailable && !oauthLogin && (
        <button
          type="button"
          onClick={connectOauth}
          disabled={authBusy}
          className="btn-primary mt-3 w-full py-2 text-sm"
        >
          {authBusy ? "…" : "Connect GitHub"}
        </button>
      )}
      {oauthLogin && (
        <p className="mt-3 text-[11px] text-white/70">
          Connected as <span className="text-white/80">@{oauthLogin}</span>
          {data?.privateIncluded ? " · private + public" : ""}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="username or github.com/…"
          className="input-premium flex-1 py-2 text-sm"
        />
        <button type="button" onClick={connect} className="btn-primary px-4 py-2 text-sm" disabled={loading}>
          {loading ? "…" : user ? "Refresh" : "Track"}
        </button>
      </div>
      {user && (
        <button type="button" onClick={clearTracking} className="mt-2 text-[11px] text-white/65 underline">
          Clear
        </button>
      )}

      {data && !data.error && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              ["Commits", data.commits],
              ["PRs", data.prs],
              ["Reviews", data.reviews],
              ["Repos", data.repos],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/70">{label} · 7d</p>
                <p className="mt-0.5 text-xl font-semibold text-white">{val}</p>
              </div>
            ))}
          </div>
          {data.topRepos.length > 0 && (
            <p className="mt-3 truncate text-[11px] text-white/70">
              {data.topRepos.join(" · ")}
            </p>
          )}
          <p className="mt-2 text-[11px] text-white/65">
            @{data.user}
            {!oauthLogin && (data.privateIncluded ? " · private + public" : " · public events")}
            {" · "}
            {data.activeDays} active day{data.activeDays === 1 ? "" : "s"}
          </p>
        </>
      )}

      {data?.error && <p className="mt-3 text-[11px] text-[#f87171]">{data.error}</p>}
      {!data && !user && (
        <p className="mt-3 text-[11px] text-white/65">
          Track commits, PRs, and reviews from the last 7 days.
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
