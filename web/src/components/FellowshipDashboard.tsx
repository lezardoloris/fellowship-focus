"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HabitTracker } from "@/components/HabitTracker";
import { StakesPanel } from "@/components/StakesPanel";
import { TrustPanel } from "@/components/TrustPanel";
import { AgendaPanel } from "@/components/AgendaPanel";
import { PremiumLoader } from "@/components/PremiumLoader";
import { GuildJourney } from "@/components/GuildJourney";
import { LevelUpModal } from "@/components/LevelUpModal";
import { useToast } from "@/components/Toasts";
import {
  currentTitle,
  leagueAccent,
  rankProgress,
  unlockedTitles,
  xpToRank,
} from "@/lib/guildRank";
import type { Waypoint } from "@/lib/waypoints";

type FellowshipData = {
  fellowship: {
    id: string;
    code: string;
    name: string;
    niche?: string;
    objective?: string;
    blocker_bypass_penalty?: number;
  };
  totalXp: number;
  stats: { totalXp: number; totalSessions: number; totalBlocks: number; totalMinutes: number };
  members: Array<{ id: string; name: string; total_xp: number; streak: number }>;
  me?: { id: string; name: string; total_xp?: number } | null;
  leaderboard: Array<{
    id: string;
    name: string;
    total_xp: number;
    streak: number;
    weekly_xp: number;
    weekly_penalties: number;
    weekly_net: number;
    league: string;
    today_minutes?: number;
  }>;
  habitLeaderboard: Array<{
    member_id: string;
    name: string;
    habits_count: number;
    total_goal: number;
    total_achieved: number;
    completion_rate: number;
    stake_score: number;
  }>;
  trustLeaderboard: Array<{
    member_id: string;
    name: string;
    proof_count_7d: number;
    screen_count_7d: number;
    webcam_count_7d: number;
    activity_score_7d: number;
    last_app: string | null;
    last_proof_at: string | null;
    trust_score: number;
  }>;
  feed: Array<{ id: string; type: string; member_name: string; message: string; created_at: string }>;
  journey: {
    currentWaypoint: Waypoint;
    nextWaypoint: Waypoint | null;
    progress: number;
  };
};

function nicheLabel(niche?: string): string {
  if (!niche) return "Guild";
  return niche.replace(/-/g, " ");
}

export function FellowshipDashboard({
  code,
  onCodeResolved,
}: {
  code: string;
  onCodeResolved?: (canonicalCode: string) => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<FellowshipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [myToken, setMyToken] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [desktopCopied, setDesktopCopied] = useState(false);
  const [error, setError] = useState("");
  const [levelUp, setLevelUp] = useState<{ rank: number; title: string } | null>(null);
  const [settleFlash, setSettleFlash] = useState<string | null>(null);

  const storageKey = `ff-member-${code}`;
  const rankKey = `ff-rank-${code}`;

  const load = useCallback(async () => {
    setError("");
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    const ownToken = stored ? (JSON.parse(stored) as { token?: string }).token : myToken;
    const headers: HeadersInit = {};
    if (ownToken) headers.Authorization = `Bearer ${ownToken}`;
    const res = await fetch(`/api/fellowship/${encodeURIComponent(code)}`, { headers });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Fellowship not found");
      setData(null);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as FellowshipData;
    setData(json);
    if (json.me?.name) setMyName(json.me.name);

    // Level-up detection (personal XP) + waypoint unlock toast
    const myXp =
      json.me?.total_xp ??
      json.leaderboard.find((m) => m.name === json.me?.name)?.total_xp ??
      0;
    if (json.me && typeof window !== "undefined") {
      const rank = xpToRank(myXp);
      const prev = Number(localStorage.getItem(rankKey) || "0");
      if (prev > 0 && rank > prev) {
        setLevelUp({ rank, title: currentTitle(json.totalXp) });
        toast.ok(`Rank ${rank}`, currentTitle(json.totalXp));
      }
      localStorage.setItem(rankKey, String(rank));

      const wpKey = `ff-waypoint-${code}`;
      const wpId = json.journey.currentWaypoint.id;
      const prevWp = localStorage.getItem(wpKey);
      if (prevWp && prevWp !== wpId) {
        toast.ok(
          json.journey.currentWaypoint.name,
          `Unlocked · ${currentTitle(json.totalXp)}`
        );
      }
      localStorage.setItem(wpKey, wpId);
    }

    const canonical = json.fellowship.code?.toLowerCase?.() || code;
    if (canonical !== code.toLowerCase()) {
      const prev = localStorage.getItem(storageKey);
      if (prev) localStorage.setItem(`ff-member-${canonical}`, prev);
      localStorage.setItem("ff-app-code", canonical);
      onCodeResolved?.(canonical);
    }
    setLoading(false);
  }, [code, storageKey, onCodeResolved, myToken, rankKey, toast]);

  useEffect(() => {
    load();
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as { token: string; name: string };
      setMyToken(parsed.token);
      setMyName(parsed.name);
    }
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load, storageKey]);

  async function joinFellowship(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName.trim()) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/fellowship/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      localStorage.setItem(storageKey, JSON.stringify({ token: json.member.token, name: json.member.name }));
      setMyToken(json.member.token);
      setMyName(json.member.name);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join";
      setError(msg);
      toast.error("Join failed", msg);
    } finally {
      setJoining(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/f/${code}`);
    toast.ok("Invite link copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyDesktopSync() {
    if (!myToken) return;
    const payload = JSON.stringify({
      apiUrl: window.location.origin,
      code,
      token: myToken,
      name: myName,
    });
    navigator.clipboard.writeText(payload);
    toast.ok("Desktop sync copied");
    setDesktopCopied(true);
    setTimeout(() => setDesktopCopied(false), 2000);
  }

  const myRow = useMemo(() => {
    if (!data || !myName) return null;
    return data.leaderboard.find((m) => m.name === myName) || null;
  }, [data, myName]);

  if (loading) return <PremiumLoader full />;

  if (error || !data) {
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center guild-fade-in">
        <p className="font-display text-lg font-semibold text-white">Guild unavailable</p>
        <p className="mt-2 text-sm text-[#fca5a5]">{error || "Not found"}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => { setLoading(true); load(); }} className="btn-primary">
            Retry
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(storageKey);
              localStorage.removeItem("ff-app-code");
              window.location.href = "/app";
            }}
            className="btn-secondary"
          >
            Back to ladder
          </button>
        </div>
      </div>
    );
  }

  const { fellowship, totalXp, stats, leaderboard, habitLeaderboard, trustLeaderboard, feed, journey } = data;
  const memberNames = Object.fromEntries(data.members.map((m) => [m.id, m.name]));
  const myMemberId = data.me?.id ?? undefined;
  const myXp = myRow?.total_xp ?? 0;
  const myProg = rankProgress(myXp);
  const guildTitle = currentTitle(totalXp);
  const titles = unlockedTitles(totalXp);
  const crestLetter = (fellowship.name || "F").trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-8 guild-fade-in">
      <LevelUpModal
        open={Boolean(levelUp)}
        rank={levelUp?.rank || 1}
        title={levelUp?.title || guildTitle}
        onClose={() => setLevelUp(null)}
      />

      {/* ── Act 1 · Identity ── */}
      <section className="glass-panel overflow-hidden p-0">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
          <div
            className="guild-crest flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#b8422e]/40 bg-[#b8422e]/15 font-display text-3xl font-bold text-white"
            aria-hidden
          >
            {crestLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
              {nicheLabel(fellowship.niche)} · {guildTitle}
            </p>
            <h1 className="font-display mt-1 truncate text-2xl font-bold text-white md:text-3xl">
              {fellowship.name}
            </h1>
            {fellowship.objective ? (
              <p className="mt-1.5 max-w-2xl text-sm text-white/60">{fellowship.objective}</p>
            ) : (
              <p className="mt-1.5 text-sm text-white/45">Focus together. Distraction is the enemy.</p>
            )}
            {myName && myRow && (
              <p className="mt-2 text-xs text-white/55">
                {myName} · Rank {myProg.rank} · {myRow.league}
                <span className="ml-2 text-white/35">{myProg.percent}% to next</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link href="/download" className="btn-primary text-sm">
              Desktop app
            </Link>
            <button type="button" onClick={copyLink} className="btn-secondary text-sm">
              {copied ? "✓ Copied" : "Invite"}
            </button>
            {myToken && (
              <button type="button" onClick={copyDesktopSync} className="btn-secondary text-sm">
                {desktopCopied ? "✓ Sync" : "Desktop sync"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
          {[
            ["Focus min", stats.totalMinutes],
            ["Sessions", stats.totalSessions],
            ["Blocked", stats.totalBlocks],
            ["Members", leaderboard.length],
          ].map(([label, val]) => (
            <div key={label as string} className="border-white/10 px-4 py-3 sm:border-r sm:last:border-r-0">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">{val}</p>
            </div>
          ))}
        </div>
      </section>

      {!myToken && (
        <form onSubmit={joinFellowship} className="glass-panel p-6">
          <h2 className="font-display text-lg text-white">Join this guild</h2>
          <div className="mt-4 flex gap-3">
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your name"
              className="input-premium flex-1"
            />
            <button type="submit" disabled={joining} className="btn-primary">
              {joining ? "…" : "Join"}
            </button>
          </div>
        </form>
      )}

      {/* ── Act 2 · Arena ── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg text-white">Arena</h2>
          <p className="text-[11px] text-white/40">Ladder · bets · feed</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Podium ladder */}
          <div className="glass-panel p-5 md:p-6">
            <h3 className="text-sm font-semibold text-white">Weekly ladder</h3>
            <p className="mt-1 text-[11px] text-white/45">Net XP this week · leagues Mordor / Gondor / Rohan / Shire</p>

            {leaderboard.length === 0 ? (
              <p className="mt-6 text-sm text-white/45">No members yet. Share the invite.</p>
            ) : (
              <>
                <div className="guild-podium mt-5 grid grid-cols-3 items-end gap-2">
                  {[1, 0, 2].map((idx) => {
                    const m = leaderboard[idx];
                    if (!m) {
                      return <div key={idx} className="rounded-lg bg-white/[0.03] py-8" />;
                    }
                    const place = idx + 1;
                    const h = place === 1 ? "h-28" : place === 2 ? "h-20" : "h-16";
                    return (
                      <div key={m.id} className="flex flex-col items-center">
                        <p className="mb-2 truncate text-center text-xs font-medium text-white/80">{m.name}</p>
                        <div
                          className={`guild-podium-bar flex w-full flex-col items-center justify-end rounded-t-lg ${h} ${
                            place === 1 ? "ladder-gold" : place === 2 ? "ladder-silver" : "ladder-bronze"
                          }`}
                        >
                          <span className="mb-2 font-display text-lg text-white/90">{place}</span>
                        </div>
                        <p className="mt-1 text-[10px] tabular-nums text-white/50">{m.weekly_net} net</p>
                      </div>
                    );
                  })}
                </div>

                <ol className="mt-5 space-y-1.5">
                  {leaderboard.length > 3 &&
                    leaderboard.slice(3).map((m, i) => (
                      <MemberRow
                        key={m.id}
                        place={i + 4}
                        name={m.name}
                        isYou={m.name === myName}
                        league={m.league}
                        weeklyNet={m.weekly_net}
                        weeklyXp={m.weekly_xp}
                        penalties={m.weekly_penalties}
                        streak={m.streak}
                        totalXp={m.total_xp}
                        fellowshipXp={totalXp}
                      />
                    ))}
                </ol>
              </>
            )}
          </div>

          <div className="space-y-5">
            {myToken && (
              <div className="glass-panel p-5 md:p-6">
                <StakesPanel
                  token={myToken}
                  fellowshipCode={code}
                  memberNames={memberNames}
                  onSettled={(note) => {
                    setSettleFlash(note);
                    toast.ok("Bet settled", note);
                    load();
                  }}
                />
              </div>
            )}
            <div className="glass-panel p-5 md:p-6">
              <h3 className="text-sm font-semibold text-white">Activity</h3>
              {settleFlash && (
                <p className="mt-2 rounded-lg border border-[#b8422e]/30 bg-[#b8422e]/10 px-3 py-2 text-xs text-white/80">
                  {settleFlash}
                </p>
              )}
              {feed.length === 0 ? (
                <p className="mt-4 text-sm text-white/45">No activity yet. Start a focus session.</p>
              ) : (
                <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm">
                  {feed.map((event) => (
                    <li
                      key={event.id}
                      className={`rounded-lg px-3 py-2.5 ${
                        event.type === "block"
                          ? "feed-block"
                          : event.type === "session"
                            ? "feed-session"
                            : event.type === "habit" || event.type === "github"
                              ? "bg-green-950/25"
                              : event.type === "stake"
                                ? "border border-[#b8422e]/25 bg-[#b8422e]/10"
                                : "bg-white/[0.04]"
                      }`}
                    >
                      <p className="text-white/90">{event.message}</p>
                      <p className="mt-1 text-[10px] text-white/40">
                        {new Date(event.created_at + "Z").toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Act 3 · Craft ── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg text-white">Craft</h2>
          <p className="text-[11px] text-white/40">Journey · habits · trust</p>
        </div>

        <GuildJourney
          totalXp={totalXp}
          current={journey.currentWaypoint}
          next={journey.nextWaypoint}
          progress={journey.progress}
        />

        {titles.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {titles.map((t) => (
              <span
                key={t.id}
                className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/60"
                title={t.waypoint}
              >
                {t.title}
              </span>
            ))}
          </div>
        )}

        {myToken && (
          <div className="glass-panel p-5 md:p-6">
            <AgendaPanel token={myToken} />
          </div>
        )}

        {myToken && (
          <div className="glass-panel p-5 md:p-6">
            <HabitTracker token={myToken} fellowshipCode={code} />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="glass-panel p-5 md:p-6">
            <h3 className="text-sm font-semibold text-white">Habit ladder</h3>
            <p className="mt-1 text-[11px] text-white/45">Stake score · auto habits weigh 100%</p>
            {habitLeaderboard.length === 0 ? (
              <p className="mt-4 text-sm text-white/45">Join to track habits.</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {habitLeaderboard.map((m, i) => (
                  <li key={m.member_id} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5">
                    <span className="w-6 text-sm font-semibold text-white/40">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white/90">
                        {m.name}
                        {m.name === myName && <span className="ml-2 text-xs accent-text">you</span>}
                      </p>
                      <p className="text-[11px] text-white/45">
                        {m.total_achieved}/{m.total_goal} · {m.completion_rate}% · score {m.stake_score}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <TrustPanel members={trustLeaderboard ?? []} myId={myMemberId} />
        </div>
      </section>

      {(fellowship.blocker_bypass_penalty ?? 0) > 0 && (
        <p className="text-center text-[11px] text-white/40">
          Rule · −{fellowship.blocker_bypass_penalty} XP if Shield is off during focus
        </p>
      )}
    </div>
  );
}

function MemberRow({
  place,
  name,
  isYou,
  league,
  weeklyNet,
  weeklyXp,
  penalties,
  streak,
  totalXp,
  fellowshipXp,
}: {
  place: number;
  name: string;
  isYou: boolean;
  league: string;
  weeklyNet: number;
  weeklyXp: number;
  penalties: number;
  streak: number;
  totalXp: number;
  fellowshipXp: number;
  compact?: boolean;
}) {
  const rank = xpToRank(totalXp);
  const title = currentTitle(fellowshipXp);
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
        isYou ? "bg-[#b8422e]/12 ring-1 ring-[#b8422e]/30" : "bg-white/[0.03]"
      }`}
    >
      <span className="w-6 text-center text-sm font-semibold text-white/40">{place}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white/90">
          {name}
          {isYou && <span className="ml-1.5 text-[10px] accent-text">you</span>}
          <span
            className="ml-2 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
            style={{ color: leagueAccent(league) }}
          >
            {league}
          </span>
        </p>
        <p className="text-[11px] text-white/45">
          Rank {rank}
          {" · "}
          <span className="text-green-400/80">+{weeklyXp}</span>
          {penalties > 0 && <span className="text-red-400/70"> −{penalties}</span>}
          {" = "}
          <strong className="text-white/70">{weeklyNet}</strong>
          {" · "}
          {streak}d
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-xs text-white/50">{totalXp}</p>
        {isYou && <p className="text-[9px] text-white/35">{title}</p>}
      </div>
    </li>
  );
}
