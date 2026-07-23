"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toasts";
import { PremiumLoader } from "@/components/PremiumLoader";
import { guildIllustration } from "@/lib/assets";

type Niche = { id: string; label: string; blurb: string };
type GuildCard = {
  code: string;
  name: string;
  niche: string;
  objective: string;
  member_count: number;
  total_xp: number;
  blocker_bypass_penalty: number;
};

type Mode = "browse" | "join" | "create" | "private";

const FALLBACK_NICHES: Niche[] = [
  { id: "builders", label: "Builders", blurb: "Ship products, code, startups" },
  { id: "students", label: "Students", blurb: "Exams, deep study, no doomscroll" },
  { id: "creators", label: "Creators", blurb: "Content, design, writing streaks" },
  { id: "fitness", label: "Fitness", blurb: "Training + focus habits" },
  { id: "deep-work", label: "Deep Work", blurb: "Long blocks, zero distractions" },
  { id: "accountability", label: "Accountability", blurb: "Check-ins, stakes, peer pressure" },
];

export function GuildDirectory({
  onJoined,
  onGoFocus,
  defaultName,
}: {
  onJoined: (code: string, token: string, name: string) => void;
  onGoFocus: () => void;
  defaultName?: string | null;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("browse");
  const [niches, setNiches] = useState<Niche[]>(FALLBACK_NICHES);
  const [guilds, setGuilds] = useState<GuildCard[]>([]);
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GuildCard | null>(null);
  const [joinName, setJoinName] = useState(defaultName || "");
  const [privateCode, setPrivateCode] = useState("");
  const [joining, setJoining] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createNiche, setCreateNiche] = useState("deep-work");
  const [createObjective, setCreateObjective] = useState("");
  const [createPublic, setCreatePublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = nicheFilter === "all" ? "" : `?niche=${encodeURIComponent(nicheFilter)}`;
      const res = await fetch(`/api/fellowship${q}`);
      const json = await res.json();
      if (Array.isArray(json.niches)) setNiches(json.niches);
      setGuilds(Array.isArray(json.guilds) ? json.guilds : []);
    } catch {
      toast.error("Couldn’t load guilds");
    } finally {
      setLoading(false);
    }
  }, [nicheFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const nicheLabel = useMemo(() => {
    const map = Object.fromEntries(niches.map((n) => [n.id, n.label]));
    return (id: string) => map[id] || id;
  }, [niches]);

  async function joinGuild(code: string) {
    const name = joinName.trim();
    if (name.length < 2) {
      toast.error("Pick a name", "At least 2 characters.");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/fellowship/${encodeURIComponent(code)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to join");
      const joinedCode = (json.fellowship?.code || code).toLowerCase();
      toast.ok(`Joined ${json.fellowship?.name || code}`);
      onJoined(joinedCode, json.member.token, json.member.name);
    } catch (err) {
      toast.error("Join failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setJoining(false);
    }
  }

  /** Re-enter a guild we already joined (token in localStorage) instead of prompting Join again. */
  function enterOrPromptJoin(g: GuildCard) {
    const clean = g.code.trim().toLowerCase();
    try {
      const raw = localStorage.getItem(`ff-member-${clean}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { token?: string; name?: string };
        if (parsed.token) {
          onJoined(clean, parsed.token, parsed.name || joinName || defaultName || "");
          return;
        }
      }
    } catch {
      /* fall through to join form */
    }
    setSelected({ ...g, code: clean });
    setMode("join");
  }

  async function createGuild(e: React.FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (name.length < 2) {
      toast.error("Name your guild");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/fellowship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          niche: createNiche,
          objective: createObjective.trim(),
          visibility: createPublic ? "public" : "private",
          blockerBypassPenalty: createNiche === "accountability" ? 15 : 5,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create");
      const code = json.fellowship.code as string;
      // Auto-join as founder
      const joinRes = await fetch(`/api/fellowship/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: (joinName.trim() || defaultName || name).slice(0, 40) }),
      });
      const joinJson = await joinRes.json();
      if (!joinRes.ok) throw new Error(joinJson.error || "Created but join failed");
      toast.ok("Guild created", createPublic ? "Listed on the public ladder." : "Private — share the code.");
      onJoined(code.toLowerCase(), joinJson.member.token, joinJson.member.name);
    } catch (err) {
      toast.error("Create failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setCreating(false);
    }
  }

  if (mode === "join" && selected) {
    return (
      <div className="mx-auto max-w-md">
        <div className="glass-panel p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">
            {nicheLabel(selected.niche)}
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-white">{selected.name}</h2>
          {selected.objective ? (
            <p className="mt-2 text-sm text-white/65">{selected.objective}</p>
          ) : null}
          <p className="mt-3 text-xs text-white/70">
            {selected.member_count} member{selected.member_count === 1 ? "" : "s"} · {selected.total_xp} XP
            {selected.blocker_bypass_penalty > 0
              ? ` · bypass −${selected.blocker_bypass_penalty} XP`
              : ""}
          </p>
          <form
            className="mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              joinGuild(selected.code);
            }}
          >
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your name in this guild"
              className="input-premium flex-1 bg-white/5"
              autoFocus
            />
            <button type="submit" disabled={joining} className="btn-primary">
              {joining ? "…" : "Join"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setMode("browse");
            }}
            className="mt-4 text-xs text-white/75 underline"
          >
            Back to ladder
          </button>
        </div>
      </div>
    );
  }

  if (mode === "private") {
    return (
      <div className="mx-auto max-w-md">
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-white">Private invite</h2>
          <p className="mt-1 mb-4 text-sm text-white/60">Enter a private guild code.</p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const clean = privateCode.trim().toLowerCase();
              if (!clean) return;
              enterOrPromptJoin({
                code: clean,
                name: clean,
                niche: "deep-work",
                objective: "",
                member_count: 0,
                total_xp: 0,
                blocker_bypass_penalty: 0,
              });
            }}
          >
            <input
              value={privateCode}
              onChange={(e) => setPrivateCode(e.target.value)}
              placeholder="fellowship-…"
              className="input-premium w-full bg-white/5"
            />
            <button type="submit" className="btn-primary w-full">
              Continue
            </button>
          </form>
          <button type="button" onClick={() => setMode("browse")} className="mt-4 text-xs text-white/75 underline">
            Back to ladder
          </button>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="glass-panel p-6">
          <h2 className="font-display text-xl font-semibold text-white">Found a guild</h2>
          <form onSubmit={createGuild} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-white/70">Name</span>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Night Watch Coders"
                className="input-premium mt-1 w-full bg-white/5"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-white/70">Niche</span>
              <select
                value={createNiche}
                onChange={(e) => setCreateNiche(e.target.value)}
                className="input-premium mt-1 w-full bg-white/5"
              >
                {niches.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} — {n.blurb}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-white/70">Objective</span>
              <textarea
                value={createObjective}
                onChange={(e) => setCreateObjective(e.target.value)}
                placeholder="What does this guild protect / push for?"
                rows={3}
                className="input-premium mt-1 w-full resize-none bg-white/5"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={createPublic}
                onChange={(e) => setCreatePublic(e.target.checked)}
                className="rounded border-white/20"
              />
              List on the public ladder
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-white/70">Your name</span>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Founder name"
                className="input-premium mt-1 w-full bg-white/5"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? "…" : "Create & join"}
              </button>
              <button type="button" onClick={() => setMode("browse")} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto min-w-0">
            <h2 className="font-display text-xl font-semibold text-white">Guild ladder</h2>
          </div>
          <button type="button" onClick={onGoFocus} className="btn-secondary text-sm">
            Stay solo
          </button>
          <button type="button" onClick={() => setMode("create")} className="btn-primary text-sm">
            Found a guild
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <FilterChip active={nicheFilter === "all"} onClick={() => setNicheFilter("all")} label="All" />
          {niches.map((n) => (
            <FilterChip
              key={n.id}
              active={nicheFilter === n.id}
              onClick={() => setNicheFilter(n.id)}
              label={n.label}
              title={n.blurb}
            />
          ))}
        </div>
      </div>

      {loading ? (
        <PremiumLoader full className="min-h-[20vh]" />
      ) : guilds.length === 0 ? (
        <div className="glass-panel p-6 text-sm text-white/75">
          No public guilds in this niche yet.{" "}
          <button type="button" onClick={() => setMode("create")} className="text-white underline">
            Found the first one
          </button>
          .
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {guilds.map((g, i) => {
            const art = guildIllustration(g.niche);
            return (
              <li key={g.code}>
                <button
                  type="button"
                  onClick={() => enterOrPromptJoin(g)}
                  className="glass-panel group relative w-full overflow-hidden p-5 text-left transition hover:bg-white/5"
                >
                  {art ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-0 w-[42%] max-w-[180px]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={art}
                        alt=""
                        className="h-full w-full object-cover object-center opacity-55 transition group-hover:opacity-70"
                        style={{
                          maskImage:
                            "linear-gradient(90deg, transparent 0%, black 38%, black 100%)",
                          WebkitMaskImage:
                            "linear-gradient(90deg, transparent 0%, black 38%, black 100%)",
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="relative z-[1] pr-[28%] sm:pr-[32%]">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-lg tabular-nums text-white/62">
                        #{String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/70">
                        {nicheLabel(g.niche)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-white">{g.name}</h3>
                    {g.objective ? (
                      <p className="mt-1 line-clamp-2 text-sm text-white/75">{g.objective}</p>
                    ) : (
                      <p className="mt-1 text-sm text-white/65">No objective set yet.</p>
                    )}
                    <p className="mt-3 text-xs text-white/65">
                      {g.member_count} member{g.member_count === 1 ? "" : "s"} · {g.total_xp} XP
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-xs text-white/65">
        Have a private code?{" "}
        <button type="button" onClick={() => setMode("private")} className="underline hover:text-white/70">
          Enter it here
        </button>
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-[#b8422e] text-white"
          : "border border-white/15 bg-black/25 text-white/65 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
