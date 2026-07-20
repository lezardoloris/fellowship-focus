"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { WAYPOINT_IMAGES } from "@/lib/assets";
import { WAYPOINTS } from "@/lib/waypoints";
import { HabitTracker } from "@/components/HabitTracker";
import { StakesPanel } from "@/components/StakesPanel";

type FellowshipData = {
  fellowship: { id: string; code: string; name: string };
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
      <div className="flex min-h-screen items-center justify-center bg-[#060806]">
        <p className="font-display gold-text animate-pulse text-xl">Loading the Fellowship…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060806]">
        <p className="text-red-400">{error || "Not found"}</p>
      </div>
    );
  }

  const { fellowship, totalXp, stats, leaderboard, habitLeaderboard, feed, journey } = data;
  const memberNames = Object.fromEntries(data.members.map((m) => [m.id, m.name]));
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/f/${code}` : `/f/${code}`;
  const wpImage = WAYPOINT_IMAGES[journey.currentWaypoint.id] ?? "/assets/journey-map.jpg";

  return (
    <main className="min-h-screen bg-[#060806]">
      {/* Hero banner */}
      <div className="relative h-56 overflow-hidden md:h-72">
        <Image src={wpImage} alt="" fill className="object-cover" priority />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-8 md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-400/70">The Fellowship</p>
          <h1 className="font-display text-4xl font-bold text-white md:text-5xl">{fellowship.name}</h1>
          {myName && (
            <p className="mt-1 text-stone-400">
              You march as <span className="gold-text font-medium">{myName}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-8 flex flex-wrap gap-3">
          <button onClick={copyLink} className="btn-primary">
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
            <h2 className="font-display mb-1 text-xl font-semibold">Join this Fellowship</h2>
            <p className="mb-4 text-sm text-stone-400">
              Pick your name. You&apos;ll get a token for the desktop app.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Aragorn"
                className="input-premium flex-1"
              />
              <button type="submit" disabled={joining} className="btn-primary">
                {joining ? "…" : "Join"}
              </button>
            </div>
          </form>
        )}

        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          {/* Journey card */}
          <div className="glass-card overflow-hidden lg:col-span-2">
            <div className="relative h-40">
              <Image src="/assets/journey-map.jpg" alt="" fill className="object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
              <div className="absolute bottom-4 left-6">
                <p className="font-display gold-text text-2xl font-bold">{journey.currentWaypoint.name}</p>
                <p className="text-sm italic text-stone-400">{journey.currentWaypoint.storyTitle}</p>
              </div>
              <div className="absolute right-6 top-4 rounded-full border border-amber-500/30 bg-black/50 px-4 py-1 text-sm font-semibold text-amber-300 backdrop-blur">
                {totalXp.toLocaleString()} XP
              </div>
            </div>
            <div className="p-6">
              <p className="mb-5 text-sm leading-relaxed text-stone-300">{journey.currentWaypoint.story}</p>
              {journey.nextWaypoint && (
                <div className="mb-5">
                  <div className="mb-2 flex justify-between text-xs text-stone-500">
                    <span>Next: {journey.nextWaypoint.name}</span>
                    <span>{journey.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${journey.progress}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-stone-600">
                    {(journey.nextWaypoint.xpRequired - totalXp).toLocaleString()} XP to go
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {WAYPOINTS.map((wp) => (
                  <div key={wp.id} className="flex items-center gap-1.5 text-xs">
                    <div className={`waypoint-dot ${totalXp >= wp.xpRequired ? "reached" : ""}`} />
                    <span className={totalXp >= wp.xpRequired ? "gold-text" : "text-stone-600"}>{wp.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="glass-card p-6">
            <h2 className="font-display mb-5 text-xl font-semibold">Fellowship stats</h2>
            <dl className="space-y-4 text-sm">
              {[
                ["Focus minutes", stats.totalMinutes],
                ["Sessions", stats.totalSessions],
                ["Sites resisted", stats.totalBlocks],
                ["Members", leaderboard.length],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between border-b border-white/5 pb-3">
                  <dt className="text-stone-500">{label}</dt>
                  <dd className="font-mono font-semibold text-amber-200/90">{val}</dd>
                </div>
              ))}
            </dl>
            {myToken && (
              <div className="mt-6 rounded-xl border border-amber-500/10 bg-black/30 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">
                  Desktop app token
                </p>
                <p className="break-all font-mono text-[10px] text-stone-600">{myToken}</p>
              </div>
            )}
          </div>
        </div>

        {/* Habit tracker — PERSO.xlsx style */}
        {myToken && (
          <div className="glass-card mb-8 p-6">
            <HabitTracker token={myToken} fellowshipCode={code} />
          </div>
        )}

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Habit ladder (group) */}
          <div className="glass-card p-6">
            <h2 className="font-display mb-1 text-xl font-semibold">Habit ladder</h2>
            <p className="mb-5 text-xs text-stone-500">
              Classement mensuel — stake score (auto = vérifiable, manuel = 80% poids)
            </p>
            {habitLeaderboard.length === 0 ? (
              <p className="text-stone-500">Rejoins pour tracker tes habits.</p>
            ) : (
              <ol className="space-y-2">
                {habitLeaderboard.map((m, i) => (
                  <li key={m.member_id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="font-display w-8 text-lg font-bold text-amber-400/80">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {m.name}
                        {m.name === myName && <span className="ml-2 text-xs text-amber-500">(you)</span>}
                      </p>
                      <p className="text-xs text-stone-500">
                        {m.total_achieved}/{m.total_goal} jours · {m.completion_rate}% · score {m.stake_score}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Stakes */}
          {myToken && (
            <div className="glass-card p-6">
              <StakesPanel token={myToken} fellowshipCode={code} memberNames={memberNames} />
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Ladder */}
          <div className="glass-card p-6">
            <h2 className="font-display mb-1 text-xl font-semibold">Weekly ladder</h2>
            <p className="mb-5 text-xs text-stone-500">
              Ranked by net XP (earned − block penalties). Leagues: Mordor ≥500 · Gondor ≥300 · Rohan ≥150
            </p>
            {leaderboard.length === 0 ? (
              <p className="text-stone-500">No members yet. Share the link!</p>
            ) : (
              <ol className="space-y-2">
                {leaderboard.map((m, i) => (
                  <li
                    key={m.id}
                    className={`flex items-center gap-3 rounded-xl p-3 ${
                      i === 0 ? "ladder-gold" : i === 1 ? "ladder-silver" : i === 2 ? "ladder-bronze" : ""
                    }`}
                  >
                    <span className="font-display flex h-9 w-9 items-center justify-center text-lg font-bold text-amber-400/80">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {m.name}
                        <span className="ml-2 rounded-full border border-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-500/80">
                          {m.league}
                        </span>
                        {m.name === myName && <span className="ml-2 text-xs text-amber-500">(you)</span>}
                      </p>
                      <p className="text-xs text-stone-500">
                        <span className="text-green-500/80">+{m.weekly_xp}</span>
                        {m.weekly_penalties > 0 && (
                          <span className="text-red-400/80"> −{m.weekly_penalties}</span>
                        )}
                        {" "}= <strong className="text-amber-200/90">{m.weekly_net} net</strong>
                        {" · "}🔥 {m.streak}d
                      </p>
                    </div>
                    <span className="font-mono text-sm text-stone-400">{m.total_xp}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Feed */}
          <div className="glass-card p-6">
            <h2 className="font-display mb-5 text-xl font-semibold">Fellowship feed</h2>
            {feed.length === 0 ? (
              <p className="text-stone-500">No activity yet. Start a focus session!</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                {feed.map((event) => (
                  <li
                    key={event.id}
                    className={`rounded-xl p-3 ${
                      event.type === "block"
                        ? "feed-block"
                        : event.type === "session"
                          ? "feed-session"
                          : event.type === "habit"
                            ? "bg-green-950/20"
                            : event.type === "stake"
                              ? "bg-amber-950/20"
                              : ""
                    }`}
                  >
                    <p className="text-stone-300">{event.message}</p>
                    <p className="mt-1 text-xs text-stone-600">
                      {new Date(event.created_at + "Z").toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="mt-12 text-center text-xs text-stone-700">
          Share · <code className="text-stone-500">{shareUrl}</code>
        </footer>
      </div>
    </main>
  );
}
