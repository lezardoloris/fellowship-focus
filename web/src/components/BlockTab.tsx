"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { desktopBridge, type DesktopState } from "@/lib/desktop";
import { playAlarm } from "@/lib/alarm";
import { logSoloSession } from "@/lib/soloStats";

type BlocklistEntry = { id: string; site: string; category: string | null };
type Prefs = {
  focus_min: number;
  focus_sec: number;
  break_min: number;
  cycles: number;
  alarm_secs: number; // -1 = infinite
  alarm_vol: number;
  anti_oops: boolean;
};

const ALARM_OPTS = [
  { id: 2, label: "2 s" },
  { id: 5, label: "5 s" },
  { id: 10, label: "10 s" },
  { id: 15, label: "15 s" },
  { id: -1, label: "infinite" },
] as const;

const DEFAULT_PREFS: Prefs = {
  focus_min: 45,
  focus_sec: 0,
  break_min: 5,
  cycles: 4,
  alarm_secs: 10,
  alarm_vol: 0.6,
  anti_oops: true,
};

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
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
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
  const [exceeded, setExceeded] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAlarmRef = useRef<(() => void) | null>(null);

  const applyDesktopState = useCallback((st: DesktopState) => {
    setDt(st);
    setSites(st.sites.map((s) => ({ id: s, site: s, category: null })));
  }, []);

  const load = useCallback(async () => {
    if (!token) {
      try {
        const bl = JSON.parse(localStorage.getItem(LOCAL_BL_KEY) || "[]") as BlocklistEntry[];
        setSites(Array.isArray(bl) ? bl : []);
        const pf = JSON.parse(localStorage.getItem(LOCAL_PREFS_KEY) || "null") as Partial<Prefs> | null;
        if (pf) setPrefs({ ...DEFAULT_PREFS, ...pf });
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
    if (pf.prefs)
      setPrefs({
        ...DEFAULT_PREFS,
        focus_min: pf.prefs.focus_min ?? DEFAULT_PREFS.focus_min,
        break_min: pf.prefs.break_min ?? DEFAULT_PREFS.break_min,
        cycles: pf.prefs.cycles ?? DEFAULT_PREFS.cycles,
      });
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
  const removeCategorySites = async (sitesToRemove: string[]) => {
    for (const site of sitesToRemove) {
      await post({ action: "remove", site });
    }
  };
  const toggleCategory = async (c: (typeof CATEGORIES)[number]) => {
    const active = c.sites.every((s) => blockedSet.has(s));
    if (active) await removeCategorySites(c.sites);
    else await addCategory(c);
  };
  const togglePreset = async (p: (typeof PRESETS)[number]) => {
    const list = presetSites(p.cats);
    const active = list.every((s) => blockedSet.has(s));
    if (active) await removeCategorySites(list);
    else await post({ action: "add", sites: list, category: "preset" });
  };
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
  const focusTotalSec = prefs.focus_min * 60 + (prefs.focus_sec || 0);

  const stopAlarm = useCallback(() => {
    stopAlarmRef.current?.();
    stopAlarmRef.current = null;
  }, []);

  const fireAlarm = useCallback(() => {
    stopAlarm();
    stopAlarmRef.current = playAlarm(prefs.alarm_secs, prefs.alarm_vol);
  }, [prefs.alarm_secs, prefs.alarm_vol, stopAlarm]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const logSession = useCallback(() => {
    const mins = Math.max(1, Math.round(focusTotalSec / 60));
    logSoloSession(mins);
    if (!token) return;
    fetch(`/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, minutes: mins, completed: true }),
    }).catch(() => {});
  }, [token, focusTotalSec]);

  const startPhase = useCallback(
    (p: Phase, cyc: number) => {
      stopAlarm();
      setExceeded(0);
      setPhase(p);
      setCycle(cyc);
      const secs = p === "focus" ? Math.max(1, focusTotalSec) : Math.max(1, prefs.break_min * 60);
      setRemaining(secs);
    },
    [focusTotalSec, prefs.break_min, stopAlarm]
  );

  useEffect(() => {
    if (phase === "idle") {
      stopTimer();
      desktopBridge.hideFloatTimer();
      return;
    }
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) {
          desktopBridge.showFloatTimer({
            remaining: r - 1,
            phase,
            cycle,
            cycles: prefs.cycles,
            label: phase === "focus" ? "FOCUS" : "BREAK",
          });
          return r - 1;
        }
        fireAlarm();
        if (phase === "focus") {
          logSession();
          if (cycle >= prefs.cycles) {
            setPhase("idle");
            desktopBridge.hideFloatTimer();
            return 0;
          }
          setTimeout(() => startPhase("break", cycle), 0);
        } else {
          setTimeout(() => startPhase("focus", cycle + 1), 0);
        }
        return 0;
      });
    }, 1000);
    desktopBridge.showFloatTimer({
      remaining,
      phase,
      cycle,
      cycles: prefs.cycles,
      label: phase === "focus" ? "FOCUS" : "BREAK",
    });
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick only on phase/cycle changes
  }, [phase, cycle, prefs.cycles, startPhase, stopTimer, logSession, fireAlarm]);

  // Track exceeded seconds when sitting at 0 (infinite alarm style)
  useEffect(() => {
    if (phase === "idle" || remaining > 0) {
      setExceeded(0);
      return;
    }
    const id = setInterval(() => setExceeded((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, remaining]);

  const start = () => startPhase("focus", 1);
  const stop = useCallback(() => {
    if (prefs.anti_oops && phase !== "idle") {
      const ok = window.confirm("Stop the timer? (Anti-Oops is on)");
      if (!ok) return;
    }
    stopTimer();
    stopAlarm();
    setPhase("idle");
    setRemaining(0);
    setCycle(0);
    setExceeded(0);
    desktopBridge.hideFloatTimer();
  }, [stopTimer, stopAlarm, prefs.anti_oops, phase]);

  useEffect(() => {
    const onClosed = () => {
      // Float × bypasses anti-oops — intentional close
      stopTimer();
      stopAlarm();
      setPhase("idle");
      setRemaining(0);
      setCycle(0);
      setExceeded(0);
      desktopBridge.hideFloatTimer();
    };
    window.addEventListener("ff-float-closed", onClosed);
    return () => window.removeEventListener("ff-float-closed", onClosed);
  }, [stopTimer, stopAlarm]);

  function testAlarm() {
    stopAlarm();
    stopAlarmRef.current = playAlarm(prefs.alarm_secs < 0 ? 2 : prefs.alarm_secs, prefs.alarm_vol);
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (loading) return <p className="animate-pulse text-sm text-white/50">Loading your shield…</p>;

  const on = Boolean(dt?.shieldOn && dt?.active);
  const inSession = phase !== "idle";

  return (
    <>
    {inSession && (
      <div className="fixed bottom-5 right-5 z-[9999]">
        <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-[#141618]/95 px-1.5 py-1.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3 rounded-lg px-3.5 py-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#b8422e]" />
            <span className="font-display text-base font-semibold tabular-nums text-white">
              {mm}:{ss}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/55">
              {phase === "focus" ? "FOCUS" : "BREAK"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopTimer();
              stopAlarm();
              setPhase("idle");
              setRemaining(0);
              setCycle(0);
              setExceeded(0);
              desktopBridge.hideFloatTimer();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-white/55 hover:bg-white/10 hover:text-white"
            aria-label="Close timer"
            title="Stop"
          >
            ×
          </button>
        </div>
      </div>
    )}

    <div className="space-y-5">
        <ShieldCard
          isDesktop={isDesktop}
          on={on}
          certReady={Boolean(dt?.certReady)}
          busy={shieldBusy}
          count={sites.length}
          onToggle={toggleShield}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
          {/* Timerform-style panel */}
          <div className="glass-panel overflow-hidden">
            {/* Live display when running */}
            {inSession && (
              <div className={`px-6 pt-6 text-center ${remaining === 0 ? "text-[#f87171]" : "text-white"}`}>
                <div className="font-display text-6xl font-bold tabular-nums">
                  {mm}:{ss}
                </div>
                {remaining === 0 && exceeded > 0 && (
                  <p className="mt-1 text-sm text-[#f87171]">
                    exceeded {String(Math.floor(exceeded / 60)).padStart(2, "0")}:
                    {String(exceeded % 60).padStart(2, "0")}
                  </p>
                )}
                <p className="mt-1 text-[11px] uppercase tracking-[0.35em] text-white/45">
                  {phase} · cycle {cycle}/{prefs.cycles}
                </p>
              </div>
            )}

            {/* Timerform */}
            <div className="border-b border-white/10 px-6 py-5">
              <p className="mb-4 text-sm font-semibold text-white/90">Timerform</p>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <Stepper
                  label="Focus"
                  value={prefs.focus_min}
                  min={1}
                  max={180}
                  suffix="min"
                  disabled={inSession}
                  onChange={(v) => savePrefs({ ...prefs, focus_min: v })}
                />
                <Stepper
                  label="Break"
                  value={prefs.break_min}
                  min={1}
                  max={60}
                  suffix="min"
                  disabled={inSession}
                  onChange={(v) => savePrefs({ ...prefs, break_min: v })}
                />
                <Stepper
                  label="Cycles"
                  value={prefs.cycles}
                  min={1}
                  max={12}
                  disabled={inSession}
                  onChange={(v) => savePrefs({ ...prefs, cycles: v })}
                />
              </div>
              <div className="flex flex-wrap items-stretch gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2 py-1">
                  <span className="pl-1 text-xs text-white/45">+ sec</span>
                  <Stepper
                    label=""
                    value={prefs.focus_sec}
                    min={0}
                    max={59}
                    disabled={inSession}
                    compact
                    onChange={(v) => savePrefs({ ...prefs, focus_sec: v })}
                  />
                </div>
                {phase === "idle" ? (
                  <button onClick={start} className="btn-primary ml-auto shrink-0 px-5">
                    Start the timer
                  </button>
                ) : (
                  <button onClick={stop} className="btn-secondary ml-auto shrink-0 px-5">
                    Stop
                  </button>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-5 px-6 py-5">
              <p className="text-sm font-semibold text-white/90">Options</p>

              <div>
                <p className="mb-2 text-sm text-white/70">Duration alarm</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALARM_OPTS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => savePrefs({ ...prefs, alarm_secs: o.id })}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                        prefs.alarm_secs === o.id
                          ? "border-[#b8422e] bg-[#b8422e] text-white"
                          : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm text-white/70">Alarm volume</p>
                <div className="flex items-center gap-3">
                  <span className="text-white/40" aria-hidden>
                    ♪
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={prefs.alarm_vol}
                    onChange={(e) => savePrefs({ ...prefs, alarm_vol: Number(e.target.value) })}
                    className="h-2 flex-1 accent-[#b8422e]"
                  />
                  <button type="button" onClick={testAlarm} className="btn-secondary py-1.5! text-xs!">
                    Test
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => savePrefs({ ...prefs, anti_oops: !prefs.anti_oops })}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                    prefs.anti_oops
                      ? "border-[#b8422e]/70 bg-[#b8422e]/20 text-white"
                      : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
                  title="Ask before stopping a running timer"
                >
                  Anti-Oops!{prefs.anti_oops ? " ✓" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setHelpOpen((v) => !v)}
                  className="rounded-md border border-[#b8422e]/50 bg-[#b8422e]/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-[#b8422e]/25"
                >
                  Display help
                </button>
              </div>

              {helpOpen && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-white/65">
                  Use the ▲ ▼ arrows on Focus / Break / Cycles to adjust quickly, then{" "}
                  <span className="text-white/90">Start the timer</span>.
                  When time is up, the alarm plays for the duration you picked (or forever if infinite).
                  <span className="text-white/90"> Anti-Oops!</span> asks for confirmation before Stop.
                  A compact timer stays bottom-right while you work — × closes it.
                </div>
              )}
            </div>
          </div>

          {/* Block list — frosted, secondary */}
          <div className="glass-panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">Block list</p>
                <p className="mt-1 max-w-md text-xs text-white/55">
                  {isDesktop
                    ? `${sites.length} site${sites.length === 1 ? "" : "s"} — blocked system-wide when Shield is ON.`
                    : `${sites.length} site${sites.length === 1 ? "" : "s"} on your list. Shield needs the desktop app to block X / YouTube.`}
                </p>
              </div>
              {!isDesktop && (
                <div className="flex gap-2">
                  <button onClick={() => copyPairing("extension")} className="btn-secondary whitespace-nowrap py-1.5! text-xs!">
                    {copied === "extension" ? "✓ Copied" : "Connect extension"}
                  </button>
                </div>
              )}
            </div>

            {/* Preconfigured lists — click to toggle on/off */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const active = presetSites(p.cats).every((s) => blockedSet.has(s));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePreset(p)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-[#b8422e] bg-[#b8422e]/25 text-white"
                        : "border-white/20 bg-black/35 text-white hover:border-white/40 hover:bg-black/45"
                    }`}
                    title={active ? `Click to remove: ${presetSites(p.cats).join(", ")}` : presetSites(p.cats).join(", ")}
                  >
                    <span className="block text-xs font-semibold">{active ? `✓ ${p.label}` : p.label}</span>
                    <span className="block text-[10px] text-white/60">{p.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Granular categories — click to toggle */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const active = c.sites.every((s) => blockedSet.has(s));
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                      active
                        ? "border-[#b8422e] bg-[#b8422e] text-white"
                        : "border-white/25 bg-black/35 text-white hover:bg-black/50"
                    }`}
                    title={active ? `Click to unblock ${c.label}` : `Block ${c.label}`}
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
    </>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  compact,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  compact?: boolean;
  onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const dec = () => !disabled && onChange(clamp(value - step));
  const inc = () => !disabled && onChange(clamp(value + step));

  return (
    <div className={compact ? "flex items-center gap-1" : "flex flex-col gap-1.5"}>
      {label ? (
        <span className="text-center text-[11px] font-medium uppercase tracking-wider text-white/45">
          {label}
        </span>
      ) : null}
      <div
        className={`flex items-center overflow-hidden rounded-lg border border-white/15 bg-white/5 ${
          disabled ? "opacity-45" : ""
        }`}
      >
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={dec}
          className="flex h-10 w-9 items-center justify-center text-lg font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Decrease ${label || "value"}`}
        >
          −
        </button>
        <div className="flex min-w-[3rem] flex-1 flex-col items-center justify-center px-1">
          <span className="text-lg font-semibold tabular-nums leading-none text-white">{value}</span>
          {suffix ? <span className="mt-0.5 text-[10px] text-white/40">{suffix}</span> : null}
        </div>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={inc}
          className="flex h-10 w-9 items-center justify-center text-lg font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Increase ${label || "value"}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ShieldCard({
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
  if (!isDesktop) {
    return (
      <div className="glass-panel flex flex-wrap items-center gap-4 p-5">
        <div className="mr-auto">
          <h2 className="text-base font-semibold text-white">Shield offline</h2>
          <p className="mt-1 max-w-xl text-xs text-white/60">
            « Not enforcing here » = cette page web ne peut pas bloquer X/YouTube toute seule.
            Relance l’app <span className="text-white/90">desktop</span> (Fellowship) pour activer
            le toggle Shield et bloquer réellement les sites.
          </p>
        </div>
        <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/50">
          No desktop bridge
        </span>
      </div>
    );
  }

  return (
    <div className={`glass-panel flex flex-wrap items-center gap-4 p-5 ${on ? "ring-1 ring-[#b8422e]/60" : ""}`}>
      <div className="mr-auto">
        <h2 className="text-base font-semibold text-white">
          Shield {on ? "ON" : "OFF"}
        </h2>
        <p className="mt-1 text-xs text-white/60">
          {!certReady
            ? "Setup one-time: open Blocker in the desktop sidebar → Activate Shield."
            : on
            ? `Blocking ${count} site${count === 1 ? "" : "s"} system-wide (including x.com). Tap to disable.`
            : "Turn ON to block your list across the whole computer — including x.com."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy || !certReady}
        onClick={onToggle}
        className={`relative h-9 w-16 shrink-0 rounded-full transition disabled:opacity-40 ${
          on ? "bg-[#b8422e]" : "bg-white/20"
        }`}
        title={certReady ? "Toggle the shield" : "Certificate setup needed"}
      >
        <span
          className={`absolute top-1 h-7 w-7 rounded-full bg-white transition-all ${
            on ? "left-8" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
