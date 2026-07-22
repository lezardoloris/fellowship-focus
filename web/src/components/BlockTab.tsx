"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { desktopBridge, type DesktopState } from "@/lib/desktop";
import { FocusOverlay } from "@/components/FocusOverlay";

type BlocklistEntry = { id: string; site: string; category: string | null };
type Prefs = { focus_min: number; break_min: number; cycles: number };

const CATEGORIES: Array<{ id: string; label: string; sites: string[] }> = [
  { id: "social", label: "Social", sites: ["x.com", "twitter.com", "facebook.com", "instagram.com", "reddit.com", "tiktok.com", "linkedin.com"] },
  { id: "video", label: "Video", sites: ["youtube.com", "netflix.com", "twitch.tv", "primevideo.com", "disneyplus.com"] },
  { id: "news", label: "News", sites: ["news.google.com", "cnn.com", "bbc.com", "lemonde.fr"] },
  { id: "shopping", label: "Shopping", sites: ["amazon.com", "ebay.com", "aliexpress.com"] },
  { id: "games", label: "Games", sites: ["store.steampowered.com", "epicgames.com", "roblox.com"] },
];

// Preconfigured lists — one tap loads a curated bundle of categories.
const PRESETS: Array<{ id: string; label: string; desc: string; cats: string[] }> = [
  { id: "deep", label: "Deep Work", desc: "Everything off", cats: ["social", "video", "news", "shopping", "games"] },
  { id: "detox", label: "Social Detox", desc: "Social media", cats: ["social"] },
  { id: "study", label: "Study", desc: "Social · video · games", cats: ["social", "video", "games"] },
  { id: "calm", label: "No Doomscroll", desc: "Social · news", cats: ["social", "news"] },
];

function presetSites(cats: string[]): string[] {
  const set = new Set<string>();
  for (const c of CATEGORIES) if (cats.includes(c.id)) c.sites.forEach((s) => set.add(s));
  return [...set];
}

type Phase = "idle" | "focus" | "break";

const LOCAL_BL_KEY = "ff-local-blocklist";
const LOCAL_PREFS_KEY = "ff-local-prefs";

function normalizeSite(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function BlockTab({
  code,
  token,
  name,
}: {
  code: string | null;
  token: string | null;
  name: string | null;
}) {
  const [sites, setSites] = useState<BlocklistEntry[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ focus_min: 25, break_min: 5, cycles: 4 });
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"" | "desktop" | "extension">("");

  // Desktop bridge — when running inside the desktop app, the Block tab
  // controls the real system-wide blocker instead of a server/local list.
  const [dtReady, setDtReady] = useState(false);
  const [dt, setDt] = useState<DesktopState | null>(null);
  const [shieldBusy, setShieldBusy] = useState(false);
  const isDesktop = Boolean(dt?.available);

  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [cycle, setCycle] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyDesktopState = useCallback((st: DesktopState) => {
    setDt(st);
    setSites(st.sites.map((s) => ({ id: s, site: s, category: null })));
  }, []);

  const load = useCallback(async () => {
    if (!token) {
      try {
        const bl = JSON.parse(localStorage.getItem(LOCAL_BL_KEY) || "[]") as BlocklistEntry[];
        setSites(Array.isArray(bl) ? bl : []);
        const pf = JSON.parse(localStorage.getItem(LOCAL_PREFS_KEY) || "null") as Prefs | null;
        if (pf) setPrefs({ focus_min: pf.focus_min, break_min: pf.break_min, cycles: pf.cycles });
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }
    const [bl, pf] = await Promise.all([
      fetch(`/api/blocklist?token=${encodeURIComponent(token)}`).then((r) => r.json()),
      fetch(`/api/prefs?token=${encodeURIComponent(token)}`).then((r) => r.json()),
    ]);
    if (bl.sites) setSites(bl.sites);
    if (pf.prefs) setPrefs({ focus_min: pf.prefs.focus_min, break_min: pf.prefs.break_min, cycles: pf.prefs.cycles });
    setLoading(false);
  }, [token]);

  // Detect the desktop bridge; if present, load state from it.
  useEffect(() => {
    let alive = true;
    desktopBridge.ready().then(async () => {
      if (!alive) return;
      if (desktopBridge.present()) {
        const st = await desktopBridge.getState();
        if (!alive) return;
        applyDesktopState(st);
        setLoading(false);
      }
      setDtReady(true);
    });
    return () => {
      alive = false;
    };
  }, [applyDesktopState]);

  // Browser mode load (server or local) — skipped inside the desktop app.
  useEffect(() => {
    if (!dtReady || desktopBridge.present()) return;
    load();
  }, [dtReady, load]);

  // Keep the shield/state fresh while inside the desktop app.
  useEffect(() => {
    if (!isDesktop) return;
    const id = setInterval(() => {
      desktopBridge.getState().then((st) => {
        if (st.available) applyDesktopState(st);
      });
    }, 3000);
    return () => clearInterval(id);
  }, [isDesktop, applyDesktopState]);

  async function toggleShield() {
    if (!isDesktop || !dt || shieldBusy) return;
    setShieldBusy(true);
    try {
      const st = await desktopBridge.setShield(!dt.shieldOn);
      applyDesktopState(st);
    } finally {
      setShieldBusy(false);
    }
  }

  const blockedSet = new Set(sites.map((s) => s.site));

  async function post(body: Record<string, unknown>) {
    // Desktop app: route add/remove through the real system blocker.
    if (isDesktop) {
      let st: DesktopState | null = null;
      if (body.action === "add") {
        const clean = ((body.sites as string[]) || []).map(normalizeSite).filter(Boolean);
        if (clean.length) st = await desktopBridge.addSites(clean);
      } else if (body.action === "remove") {
        st = await desktopBridge.removeSite(body.site as string);
      }
      if (st && st.available) applyDesktopState(st);
      return;
    }
    // Solo mode: persist the blocklist locally, no server round-trip.
    if (!token) {
      setSites((prev) => {
        let next = prev;
        if (body.action === "add") {
          const existing = new Set(prev.map((s) => s.site));
          const category = (body.category as string) ?? null;
          const added = ((body.sites as string[]) || [])
            .map(normalizeSite)
            .filter((s) => s && !existing.has(s))
            .map((s) => ({ id: s, site: s, category }));
          next = [...prev, ...added];
        } else if (body.action === "remove") {
          next = prev.filter((s) => s.site !== body.site);
        }
        localStorage.setItem(LOCAL_BL_KEY, JSON.stringify(next));
        return next;
      });
      return;
    }
    const res = await fetch(`/api/blocklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
    const json = await res.json();
    if (json.sites) setSites(json.sites);
  }

  const addCategory = (c: (typeof CATEGORIES)[number]) => post({ action: "add", sites: c.sites, category: c.id });
  const applyPreset = (p: (typeof PRESETS)[number]) => post({ action: "add", sites: presetSites(p.cats), category: "preset" });
  const removeSite = (site: string) => post({ action: "remove", site });
  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!custom.trim()) return;
    post({ action: "add", sites: [custom], category: "custom" });
    setCustom("");
  }

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    if (!token) {
      localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(next));
      return;
    }
    await fetch(`/api/prefs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...next }),
    });
  }

  function copyPairing(kind: "desktop" | "extension") {
    navigator.clipboard.writeText(
      JSON.stringify({
        apiUrl: window.location.origin,
        code,
        token,
        name,
        sites: sites.map((s) => s.site),
        prefs,
      })
    );
    setCopied(kind);
    setTimeout(() => setCopied(""), 2000);
  }

  // ── Focus timer ────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const logSession = useCallback(() => {
    if (!token) return; // solo mode: nothing to report to a guild
    fetch(`/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, minutes: prefs.focus_min, completed: true }),
    }).catch(() => {});
  }, [token, prefs.focus_min]);

  const startPhase = useCallback((p: Phase, cyc: number) => {
    setPhase(p);
    setCycle(cyc);
    setRemaining((p === "focus" ? prefs.focus_min : prefs.break_min) * 60);
  }, [prefs.focus_min, prefs.break_min]);

  useEffect(() => {
    if (phase === "idle") {
      stopTimer();
      return;
    }
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        // phase finished
        if (phase === "focus") {
          logSession();
          if (cycle >= prefs.cycles) {
            setPhase("idle");
            return 0;
          }
          setTimeout(() => startPhase("break", cycle), 0);
        } else {
          setTimeout(() => startPhase("focus", cycle + 1), 0);
        }
        return 0;
      });
    }, 1000);
    return stopTimer;
  }, [phase, cycle, prefs.cycles, startPhase, stopTimer, logSession]);

  const start = () => startPhase("focus", 1);
  const stop = useCallback(() => {
    stopTimer();
    setPhase("idle");
    setRemaining(0);
    setCycle(0);
    desktopBridge.hideFloatTimer();
  }, [stopTimer]);

  // OS float timer × → end session
  useEffect(() => {
    const onClosed = () => stop();
    window.addEventListener("ff-float-closed", onClosed);
    return () => window.removeEventListener("ff-float-closed", onClosed);
  }, [stop]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (loading) return <p className="animate-pulse text-sm text-[#9ca3af]">Loading your shield…</p>;

  const on = Boolean(dt?.shieldOn && dt?.active);
  const inSession = phase !== "idle";

  return (
    <>
    <FocusOverlay
      open={inSession}
      phase={phase}
      remaining={remaining}
      cycle={cycle}
      cycles={prefs.cycles}
      onStop={stop}
    />
    <div className="relative overflow-hidden rounded-2xl border border-white/5">
      {/* HD fellowship image — the hero, everything else floats over it */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/fellowship-hero.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 block-scrim" aria-hidden />

      <div className="relative p-5 md:p-8">
        {/* Header: wordmark + compact shield */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="hero-title">
            <p className="font-display text-xs font-semibold tracking-[0.35em] text-white/70">
              THE FELLOWSHIP
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
              Stay on the path.
            </h1>
          </div>
          <ShieldPill
            isDesktop={isDesktop}
            on={on}
            certReady={Boolean(dt?.certReady)}
            busy={shieldBusy}
            count={sites.length}
            onToggle={toggleShield}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* Focus timer — frosted, secondary */}
          <div className="glass-panel p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
              {phase === "idle" ? "Focus session" : phase === "focus" ? `Cycle ${cycle}/${prefs.cycles} · deep work` : `Cycle ${cycle}/${prefs.cycles} · break`}
            </p>
            <div className="my-7 text-center">
              <div className={`font-display text-7xl font-bold tabular-nums ${phase === "break" ? "text-white/60" : "text-white"}`}>
                {phase === "idle" ? `${String(prefs.focus_min).padStart(2, "0")}:00` : `${mm}:${ss}`}
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-[0.4em] text-white/45">
                {phase === "idle" ? "Ready" : phase}
              </p>
            </div>
            {phase === "idle" ? (
              <button onClick={start} className="btn-primary w-full">Start focus · fullscreen</button>
            ) : (
              <button onClick={stop} className="btn-secondary w-full">Stop</button>
            )}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              {([
                ["Focus", "focus_min", 1, 120],
                ["Break", "break_min", 1, 60],
                ["Cycles", "cycles", 1, 12],
              ] as const).map(([label, key, min, max]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-white/45">{label}</span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={prefs[key]}
                    disabled={phase !== "idle"}
                    onChange={(e) => savePrefs({ ...prefs, [key]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })}
                    className="input-premium w-full bg-white/5 text-center"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Block list — frosted, secondary */}
          <div className="glass-panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">Block list</p>
                <p className="mt-1 max-w-md text-xs text-white/55">
                  {isDesktop
                    ? `${sites.length} site${sites.length === 1 ? "" : "s"} blocked system-wide when the Shield is on.`
                    : `${sites.length} site${sites.length === 1 ? "" : "s"} on your shield. Enforced by the extension & desktop app.`}
                </p>
              </div>
              {!isDesktop && (
                <div className="flex gap-2">
                  <button onClick={() => copyPairing("extension")} className="btn-secondary whitespace-nowrap py-1.5! text-xs!">
                    {copied === "extension" ? "✓ Copied" : "Connect extension"}
                  </button>
                  <button onClick={() => copyPairing("desktop")} className="btn-secondary whitespace-nowrap py-1.5! text-xs!">
                    {copied === "desktop" ? "✓ Copied" : "Sync desktop"}
                  </button>
                </div>
              )}
            </div>

            {/* Preconfigured lists */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const active = presetSites(p.cats).every((s) => blockedSet.has(s));
                return (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    disabled={active}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? "border-white/10 bg-white/5 text-white/40"
                        : "border-[#b8422e]/50 bg-[#b8422e]/10 text-white hover:bg-[#b8422e]/20"
                    }`}
                    title={presetSites(p.cats).join(", ")}
                  >
                    <span className="block text-xs font-semibold">{active ? `✓ ${p.label}` : p.label}</span>
                    <span className="block text-[10px] text-white/45">{p.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Granular categories */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const active = c.sites.every((s) => blockedSet.has(s));
                return (
                  <button
                    key={c.id}
                    onClick={() => addCategory(c)}
                    disabled={active}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? "border-white/10 text-white/40"
                        : "border-white/15 text-white/80 hover:bg-white/10"
                    }`}
                    title={c.sites.join(", ")}
                  >
                    {active ? `✓ ${c.label}` : `+ ${c.label}`}
                  </button>
                );
              })}
            </div>

            <form onSubmit={addCustom} className="mt-4 flex gap-2">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="add a site, e.g. news.ycombinator.com"
                className="input-premium flex-1 bg-white/5"
              />
              <button type="submit" className="btn-primary">Add</button>
            </form>

            <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {sites.length === 0 ? (
                <li className="rounded-lg bg-white/5 p-4 text-sm text-white/50">
                  No sites yet. Pick a preconfigured list above — this is your shield.
                </li>
              ) : (
                sites.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <span className="flex-1 text-sm text-white/90">{s.site}</span>
                    {s.category && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
                        {s.category}
                      </span>
                    )}
                    <button
                      onClick={() => removeSite(s.site)}
                      className="text-white/45 transition hover:text-red-400"
                      aria-label={`Remove ${s.site}`}
                    >
                      ✕
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function ShieldPill({
  isDesktop,
  on,
  certReady,
  busy,
  count,
  onToggle,
}: {
  isDesktop: boolean;
  on: boolean;
  certReady: boolean;
  busy: boolean;
  count: number;
  onToggle: () => void;
}) {
  // Browser mode — the page can't block other sites itself.
  if (!isDesktop) {
    return (
      <div className="pill-glass flex items-center gap-2 rounded-full px-3.5 py-2">
        <span className="h-2 w-2 rounded-full bg-white/40" />
        <span className="text-xs text-white/70">Not enforcing here</span>
      </div>
    );
  }

  return (
    <div className={`pill-glass flex items-center gap-3 rounded-full py-2 pl-4 pr-2 ${on ? "ring-1 ring-[#b8422e]/70" : ""}`}>
      <div className="text-right">
        <p className="text-xs font-semibold leading-none text-white">Shield {on ? "ON" : "OFF"}</p>
        <p className="mt-0.5 text-[10px] leading-none text-white/50">
          {!certReady ? "setup needed" : on ? `${count} blocked` : "tap to arm"}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        onClick={onToggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-[#b8422e]" : "bg-white/20"}`}
        title={certReady ? "Toggle the shield" : "Setup needed"}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
