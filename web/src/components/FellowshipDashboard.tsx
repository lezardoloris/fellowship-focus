"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WAYPOINT_IMAGES } from "@/lib/assets";
import { WAYPOINTS } from "@/lib/waypoints";
import { HabitTracker } from "@/components/HabitTracker";
import { StakesPanel } from "@/components/StakesPanel";
import { TrustPanel } from "@/components/TrustPanel";
import { AgendaPanel } from "@/components/AgendaPanel";

type FellowshipData = {
  fellowship: { id: string; code: string; name: string; blocker_bypass_penalty?: number };
  totalXp: number;
  stats: { totalXp: number; totalSessions: number; totalBlocks: number; totalMinutes: number };
  members: Array<{ id: string; name: string; total_xp: number; streak: number; token: string }>;
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
    currentWaypoint: (typeof WAYPOINTS)[0];
    nextWaypoint: (typeof WAYPOINTS)[0] | null;
    progress: number;
  };
};

export function FellowshipDashboard({ code }: { code: string }) {
  const [data, setData] = useState<FellowshipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [myToken, setMyToken] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [desktopCopied, setDesktopCopied] = useState(false);
  const [error, setError] = useState("");

  const storageKey = `ff-member-${code}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/fellowship/${code}`);
    if (!res.ok) {
      setError("Fellowship not found");
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [code]);

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
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/f/${code}`);
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
    setDesktopCopied(true);
    setTimeout(() => setDesktopCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1c1e]">
        <p className="animate-pulse text-sm text-[#9ca3af]">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1c1e]">
        <p className="text-red-400">{error || "Not found"}</p>
      </div>
    );
  }

  const { fellowship, totalXp, stats, leaderboard, habitLeaderboard, trustLeaderboard, feed, journey } = data;
  const memberNames = Object.fromEntries(data.members.map((m) => [m.id, m.name]));
  const myMemberId = myToken ? data.members.find((m) => m.token === myToken)?.id : undefined;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/f/${code}` : `/f/${code}`;
  const journeyImage =
    WAYPOINT_IMAGES[journey.currentWaypoint.id] ?? "/assets/journey-map.jpg";

  return (
    <main className="min-h-screen bg-[#1a1c1e]">
      <header className="border-b border-[#3a3d40] px-4 py-6 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#9ca3af]">Fellowship</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-[#f4f4f5] md:text-3xl">{fellowship.name}</h1>
        {myName && (
          <p className="mt-1 text-sm text-[#9ca3af]">
            Signed in as <span className="font-medium text-[#f4f4f5]">{myName}</span>
          </p>
        )}
        {(fellowship.blocker_bypass_penalty ?? 0) > 0 && (
          <p className="mt-2 max-w-xl text-sm text-[#9ca3af]">
            Guild rule: −{fellowship.blocker_bypass_penalty} XP if the blocker is turned off during a focus session.
          </p>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/download" className="btn-primary">
            Download Windows app
          </Link>
          <button onClick={copyLink} className="btn-secondary">
            {copied ? "✓ Link copied" : "Copy invite link"}
          </button>
          {myToken && (
            <button onClick={copyDesktopSync} className="btn-secondary">
              {desktopCopied ? "✓ Copied for desktop" : "Copy for desktop app"}
            </button>
          )}
        </div>

        {!myToken && (
          <form onSubmit={joinFellowship} className="glass-card mb-8 p-6">
            <h2 className="mb-1 text-lg font-semibold">Join this Fellowship</h2>
            <p className="mb-4 text-sm text-[#9ca3af]">Pick your name. You&apos;ll get a token for the desktop app.</p>
            <div className="flex gap-3">
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

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Focus minutes", stats.totalMinutes],
            ["Sessions", stats.totalSessions],
            ["Sites blocked", stats.totalBlocks],
            ["Members", leaderboard.length],
          ].map(([label, val]) => (
            <div key={label as string} className="glass-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[#9ca3af]">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-[#f4f4f5]">{val}</p>
            </div>
          ))}
        </div>

        {myToken && (
          <div className="mb-8">
            <AgendaPanel token={myToken} />
          </div>
        )}

        <div className="glass-card mb-8 overflow-hidden p-0">
          <div className="relative h-40 w-full">
            <Image src={journeyImage} alt="" fill className="object-cover opacity-70" />
            <div className="hero-overlay absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <h2 className="text-xl font-semibold text-[#f4f4f5]">{journey.currentWaypoint.name}</h2>
              <p className="text-sm text-[#9ca3af]">{journey.currentWaypoint.storyTitle}</p>
            </div>
          </div>
          <div className="p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#9ca3af]">Journey progress</p>
            </div>
            <span className="rounded-full border border-[#3a3d40] bg-[#2e3134] px-3 py-1 text-sm font-medium text-[#f4f4f5]">
              {totalXp.toLocaleString()} XP
            </span>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-[#9ca3af]">{journey.currentWaypoint.story}</p>
          {journey.nextWaypoint && (
            <div className="mb-5">
              <div className="mb-2 flex justify-between text-xs text-[#9ca3af]">
                <span>Next: {journey.nextWaypoint.name}</span>
                <span>{journey.progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${journey.progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-[#9ca3af]">
                {(journey.nextWaypoint.xpRequired - totalXp).toLocaleString()} XP to go
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {WAYPOINTS.map((wp) => (
              <div key={wp.id} className="flex items-center gap-1.5 text-xs">
                <div className={`waypoint-dot ${totalXp >= wp.xpRequired ? "reached" : ""}`} />
                <span className={totalXp >= wp.xpRequired ? "accent-text" : "text-[#9ca3af]"}>{wp.name}</span>
              </div>
            ))}
          </div>
          </div>
        </div>

        {myToken && (
          <div className="glass-card mb-8 p-6">
            <HabitTracker token={myToken} fellowshipCode={code} />
          </div>
        )}

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-6">
            <h2 className="mb-1 text-lg font-semibold">Habit ladder</h2>
            <p className="mb-5 text-xs text-[#9ca3af]">Monthly ranking — stake score (auto = verified, manual = 80% weight)</p>
            {habitLeaderboard.length === 0 ? (
              <p className="text-[#9ca3af]">Join to track habits.</p>
            ) : (
              <ol className="space-y-2">
                {habitLeaderboard.map((m, i) => (
                  <li key={m.member_id} className="flex items-center gap-3 rounded-lg bg-[#2e3134]/50 p-3">
                    <span className="w-8 text-lg font-semibold text-[#9ca3af]">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {m.name}
                        {m.name === myName && <span className="ml-2 text-xs accent-text">(you)</span>}
                      </p>
                      <p className="text-xs text-[#9ca3af]">
                        {m.total_achieved}/{m.total_goal} days · {m.completion_rate}% · score {m.stake_score}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {myToken && (
            <div className="glass-card p-6">
              <StakesPanel token={myToken} fellowshipCode={code} memberNames={memberNames} />
            </div>
          )}
        </div>

        <div className="mb-8">
          <TrustPanel members={trustLeaderboard ?? []} myId={myMemberId} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-6">
            <h2 className="mb-1 text-lg font-semibold">Weekly ladder</h2>
            <p className="mb-5 text-xs text-[#9ca3af]">
              Ranked by net XP (earned − block penalties). Leagues: Mordor ≥500 · Gondor ≥300 · Rohan ≥150
            </p>
            {leaderboard.length === 0 ? (
              <p className="text-[#9ca3af]">No members yet. Share the link!</p>
            ) : (
              <ol className="space-y-2">
                {leaderboard.map((m, i) => (
                  <li
                    key={m.id}
                    className={`flex items-center gap-3 rounded-lg p-3 ${
                      i === 0 ? "ladder-gold" : i === 1 ? "ladder-silver" : i === 2 ? "ladder-bronze" : "bg-[#2e3134]/30"
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center text-lg font-semibold text-[#9ca3af]">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {m.name}
                        <span className="ml-2 rounded-full border border-[#3a3d40] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#9ca3af]">
                          {m.league}
                        </span>
                        {m.name === myName && <span className="ml-2 text-xs accent-text">(you)</span>}
                      </p>
                      <p className="text-xs text-[#9ca3af]">
                        <span className="text-green-500/80">+{m.weekly_xp}</span>
                        {m.weekly_penalties > 0 && <span className="text-red-400/80"> −{m.weekly_penalties}</span>}
                        {" "}= <strong className="text-[#f4f4f5]">{m.weekly_net} net</strong>
                        {" · "}{m.streak}d streak
                      </p>
                    </div>
                    <span className="font-mono text-sm text-[#9ca3af]">{m.total_xp}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="glass-card p-6">
            <h2 className="mb-5 text-lg font-semibold">Activity feed</h2>
            {feed.length === 0 ? (
              <p className="text-[#9ca3af]">No activity yet. Start a focus session!</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                {feed.map((event) => (
                  <li
                    key={event.id}
                    className={`rounded-lg p-3 ${
                      event.type === "block"
                        ? "feed-block"
                        : event.type === "session"
                          ? "feed-session"
                          : event.type === "habit"
                            ? "bg-green-950/20"
                            : event.type === "stake"
                              ? "bg-[#2e3134]"
                              : "bg-[#2e3134]/30"
                    }`}
                  >
                    <p className="text-[#f4f4f5]">{event.message}</p>
                    <p className="mt-1 text-xs text-[#9ca3af]">
                      {new Date(event.created_at + "Z").toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="mt-12 text-center text-xs text-[#9ca3af]">
          Share · <code className="text-[#9ca3af]">{shareUrl}</code>
        </footer>
      </div>
    </main>
  );
}
