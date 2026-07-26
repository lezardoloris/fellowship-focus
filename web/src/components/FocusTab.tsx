"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { HabitTracker } from "@/components/HabitTracker";
import { useToast } from "@/components/Toasts";
import { desktopBridge, type WeeklyStats } from "@/lib/desktop";
import { parseGithubUsername } from "@/lib/githubActivity";
import { buildSoloWeeklyStats, saveSoloOkr } from "@/lib/soloStats";
import { StreakBadge } from "@/components/StreakBadge";
import { FocusScoreHero } from "@/components/FocusScoreHero";
import { BillablePanel } from "@/components/BillablePanel";
import { MoneyPanel } from "@/components/MoneyPanel";
import { TaskList } from "@/components/TaskList";
import { RitualWizard } from "@/components/RitualWizard";
import { WeeklyDigestPanel } from "@/components/WeeklyDigestPanel";
import { TemptationsPanel } from "@/components/TemptationsPanel";
import { BarSeries } from "@/components/Charts";
import { StatTile } from "@/components/Panel";

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
  return `${fmt(start)} - ${fmt(end)}`;
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
  const [ghWeek, setGhWeek] = useState<{ commits: number; prs: number; reviews: number; xp: number } | null>(
    null
  );
  const onGhSynced = useCallback((w: { commits: number; prs: number; reviews: number; xp: number }) => {
    setGhWeek(w);
  }, []);

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
          <div className="mt-1">
            <StreakBadge streak={stats.kpis.streak} />
          </div>
        </div>
      </div>

      {empty && (
        <div className="premium-panel border-[#b8422e]/40 px-5 py-4 text-sm pp-body">
          Finish a timer on <span className="font-semibold pp-strong">Focus</span> to fill this week.
        </div>
      )}

      {/* [HUD-H2] Mock order: score + weekly side by side, money full width,
          then week/ladder, temptations, habits. */}
      {token && (
        <div className="grid gap-4 lg:grid-cols-2">
          <FocusScoreHero
            token={token}
            sparkline={stats.days.map((d) => d.focus_score)}
          />
          <WeeklyDigestPanel token={token} />
        </div>
      )}

      {token && <MoneyPanel token={token} />}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <WeekPanel stats={stats} today={today} onSaveOkr={saveOkr} githubWeek={ghWeek} />
        <div className="space-y-5">
          <LadderCard stats={stats} />
          <GitHubCard token={token} onSynced={onGhSynced} />
        </div>
      </div>

      {token && <TemptationsPanel token={token} />}

      {token && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <TaskList token={token} />
            <BillablePanel token={token} />
          </div>
          {/* [UX-E9.1] Was a 3rd child in a 2-col grid — it orphaned at half
              width beside an empty cell. [UX-E9.5] And it always showed the
              morning planner, even at 6pm. */}
          <RitualWizard
            token={token}
            kind={new Date().getHours() >= 17 ? "shutdown" : "morning"}
          />
        </>
      )}

      <div className="premium-panel p-6">
        <HabitTracker token={token} fellowshipCode={fellowshipCode} />
      </div>
    </div>
  );
}

function WeekPanel({
  stats,
  today,
  onSaveOkr,
  githubWeek,
}: {
  stats: WeeklyStats;
  today: string;
  onSaveOkr: (patch: Record<string, number>) => void;
  githubWeek: { commits: number; prs: number; reviews: number; xp: number } | null;
}) {
  const { days, kpis, okr } = stats;

  // [HUD-H2] Streak KPI removed — StreakBadge at the top owns it (1× only).
  // Sparklines use 8-week history so the tiles stop looking empty under the numeral.
  const hoursSpark = stats.history.map((w) => w.work_minutes);
  const scoreSpark = stats.history.map((w) => w.avg_focus_score);
  const daysSpark = stats.days.map((d) => (d.focus_minutes > 0 ? 1 : 0));

  return (
    <div className="hud-panel p-6" data-augmented-ui="tl-clip br-clip both">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Week overview</h2>
        <p className="mt-0.5 text-xs pp-muted">{rangeLabel(stats.weekStart)}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-4">
          <StatTile
            label="Focus this week"
            value={`${kpis.focus_hours} h`}
            sub={`target ${okr.focus_hours.target} h`}
            history={hoursSpark}
          />
        </div>
        <div className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-4">
          <StatTile
            label="Avg focus score"
            value={`${kpis.avg_focus_score}`}
            sub="work vs distraction"
            history={scoreSpark}
            sparkTone={kpis.avg_focus_score >= 70 ? "success" : kpis.avg_focus_score >= 40 ? "warning" : "danger"}
          />
        </div>
        <div className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-4">
          <StatTile
            label="Focus days"
            value={`${kpis.focus_days}`}
            sub="days with ≥25 min"
            history={daysSpark}
          />
        </div>
        <div className="rounded-lg border border-[#3a3d40] bg-[#2e3134]/40 p-4">
          <StatTile
            label="GitHub · 7d"
            value={githubWeek ? `${githubWeek.commits}` : "—"}
            sub={
              githubWeek
                ? `${githubWeek.prs} PRs · ${githubWeek.reviews} reviews` +
                  (githubWeek.xp > 0 ? ` · +${githubWeek.xp} XP` : "")
                : "connect coding track"
            }
          />
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider pp-muted">Focus calendar</p>
        {/* [HUD-H1] Was hand-rolled divs with their own percent-of-max maths and
            only a title= tooltip. Now the shared layer: real scale, real
            tooltip, real baseline. `renderLabel` keeps the per-day score and
            weekday that a plain migration would have dropped. */}
        <BarSeries
          height={112}
          data={days.map((d) => ({ label: d.weekday, value: d.focus_minutes }))}
          highlightIndex={days.findIndex((d) => d.date === today)}
          formatter={(v) => `${v} min focus`}
          renderLabel={(_, i) => {
            const d = days[i];
            return (
              <div className="flex flex-col items-center gap-0.5 pt-0.5">
                {d.focus_score > 0 ? (
                  <span
                    className="hud-num text-[10px] font-semibold"
                    style={{ color: scoreColor(d.focus_score) }}
                  >
                    {d.focus_score}
                  </span>
                ) : (
                  <span className="text-[10px] pp-faint">·</span>
                )}
                <span className="text-[11px]">{d.weekday}</span>
              </div>
            );
          }}
          emptyLabel="No focus logged this week yet."
        />
        <p className="mt-2 text-[11px] pp-muted">
          Bars = focus minutes · number = daily focus score (green ≥70, amber ≥40, red below).
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider pp-muted">OKR of the week</p>

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
  const { league, history } = stats;
  const style = LEAGUE_STYLE[league.name] ?? LEAGUE_STYLE.Shire;
  const toNext = league.next ? Math.max(0, league.next.at - league.hours) : 0;
  const nextPct = league.next ? pct(league.hours, league.next.at) : 100;

  return (
    <div className="hud-panel p-6" data-augmented-ui="tl-clip br-clip both">
      <p className="text-xs font-medium uppercase tracking-wider pp-body">Your ladder</p>
      <div className="mt-3 flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
          style={{ background: `${style.color}22`, color: style.color, border: `1px solid ${style.color}55` }}
        >
          {league.name[0]}
        </span>
        <div>
          <p className="text-lg font-semibold" style={{ color: style.color }}>{league.name}</p>
          <p className="text-[11px] pp-muted">{style.blurb}</p>
        </div>
      </div>

      {league.next && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] pp-muted">
            <span>To {league.next.name}</span>
            <span>{toNext.toFixed(1)} h to go</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${nextPct}%` }} />
          </div>
        </div>
      )}

      {/* [UX-E9.3] Streak and weekly hours were shown here AND in WeekPanel AND
          in the digest — the audit counted streak 4× on one screen. WeekPanel
          owns those numbers; the ladder keeps only what is unique to it. */}

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider pp-muted">8-week history</p>
        {/* [HUD-H1] Third and last hand-rolled scaling formula, removed. */}
        <BarSeries
          height={64}
          data={history.map((w) => ({ label: w.weekStart, value: w.work_minutes }))}
          highlightIndex={history.length - 1}
          formatter={(v) => `${(v / 60).toFixed(1)} h`}
          emptyLabel="No history yet. Finish a week to fill this."
        />
      </div>
    </div>
  );
}

function GitHubCard({
  token,
  onSynced,
}: {
  token?: string | null;
  onSynced?: (w: { commits: number; prs: number; reviews: number; xp: number }) => void;
}) {
  const toast = useToast();
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
    if (token) {
      fetch(`/api/github/link?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.week) onSynced?.(j.week);
          if (j.link?.github_login && !saved) {
            setUser(j.link.github_login);
            setDraft(j.link.github_login);
          }
        })
        .catch(() => {});
    }
  }, [token, onSynced]);

  const fetchStats = useCallback(
    async (u: string) => {
      if (!u) {
        setData(null);
        return;
      }
      setLoading(true);
      try {
        const q = new URLSearchParams({ user: u });
        if (token) q.set("token", token);
        const res = await fetch(`/api/github/activity?${q}`);
        const json = await res.json();
        if (!res.ok) {
          const err = json.error || "GitHub error";
          toast.error("GitHub", err);
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
            error: err,
          });
          return;
        }
        setData(json as GitHubStats);
        if (json.week) onSynced?.(json.week);
        if (json.sync?.xpAwarded > 0) {
          toast.ok("Coding XP", `+${json.sync.xpAwarded} XP from GitHub`);
        }
        if (json.user && json.user !== u) {
          localStorage.setItem(GITHUB_KEY, json.user);
          setUser(json.user);
          setDraft(json.user);
        }
        if (token && oauthLogin && json.user?.toLowerCase() === oauthLogin.toLowerCase()) {
          fetch("/api/github/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }).catch(() => {});
        }
      } catch {
        toast.error("GitHub", "Network error");
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
    },
    [token, toast, onSynced, oauthLogin]
  );

  useEffect(() => {
    if (user) fetchStats(user);
  }, [user, fetchStats]);

  const connect = () => {
    const u = parseGithubUsername(draft);
    if (!u) {
      toast.error("GitHub", "Enter a username or github.com URL");
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
    <div className="premium-panel p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider pp-body">GitHub coding</p>
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
        <p className="mt-3 text-[11px] pp-body">
          Connected as <span className="pp-body">@{oauthLogin}</span>
          {data?.privateIncluded ? " · private + public" : ""}
          {token ? " · linked to guild" : ""}
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
          {loading ? "…" : user ? "Sync" : "Track"}
        </button>
      </div>
      {user && (
        <button type="button" onClick={clearTracking} className="mt-2 text-[11px] pp-muted underline">
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
                <p className="text-[10px] uppercase tracking-wider pp-body">{label} · 7d</p>
                <p className="mt-0.5 text-xl font-semibold text-white">{val}</p>
              </div>
            ))}
          </div>
          {data.topRepos.length > 0 && (
            <p className="mt-3 truncate text-[11px] pp-body">{data.topRepos.join(" · ")}</p>
          )}
          <p className="mt-2 text-[11px] pp-muted">
            @{data.user}
            {!oauthLogin && (data.privateIncluded ? " · private + public" : " · public events")}
            {" · "}
            {data.activeDays} active day{data.activeDays === 1 ? "" : "s"}
          </p>
        </>
      )}

      {data?.error && <p className="mt-3 text-[11px] text-[#f87171]">{data.error}</p>}
      {!data && !user && (
        <p className="mt-3 text-[11px] pp-muted">
          Track commits, PRs, and reviews. Connect OAuth + guild for XP & habit auto-check.
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
        <div className="flex items-center gap-1 text-xs pp-muted">
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
          <span className="text-xs pp-muted">
            {current} <span className="pp-faint">({percent}%)</span>
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
    <span className="flex items-center gap-0.5 text-xs pp-muted">
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
