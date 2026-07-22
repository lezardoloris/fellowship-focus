"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { desktopBridge, type DesktopState } from "@/lib/desktop";
import { playAlarm } from "@/lib/alarm";
import { logSoloSession } from "@/lib/soloStats";
import {
  analyzeHistoryViaExtension,
  connectExtension,
  extensionCommand,
  pingExtension,
  type HistorySuggestion,
} from "@/lib/extensionBridge";
import { useToast } from "@/components/Toasts";
import { BlockerControls, requestHardUnlock } from "@/components/BlockerControls";
import {
  DEFAULT_BLOCKER_SETTINGS,
  mergeBlockerSettings,
  type BlockerSettings,
} from "@/lib/blockerSettings";

type BlocklistEntry = { id: string; site: string; category: string | null };
type Prefs = BlockerSettings;

const ALARM_OPTS = [
  { id: 2, label: "2 s" },
  { id: 5, label: "5 s" },
  { id: 10, label: "10 s" },
  { id: 15, label: "15 s" },
  { id: -1, label: "infinite" },
] as const;

const DEFAULT_PREFS: Prefs = DEFAULT_BLOCKER_SETTINGS;

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

/** Focus / break / cycle presets grounded in common productivity research (not medical advice). */
const TIMER_PRESETS: Array<{
  id: string;
  label: string;
  focus: number;
  break: number;
  cycles: number;
  basis: string;
}> = [
  { id: "pomodoro", label: "25 / 5", focus: 25, break: 5, cycles: 4, basis: "Pomodoro (Cirillo)" },
  { id: "desk52", label: "52 / 17", focus: 52, break: 17, cycles: 3, basis: "DeskTime peak-productivity split" },
  { id: "ultradian", label: "90 / 20", focus: 90, break: 20, cycles: 2, basis: "Ultradian rhythm (~90 min)" },
  { id: "deep45", label: "45 / 5", focus: 45, break: 5, cycles: 4, basis: "Deep-work block" },
  { id: "flow50", label: "50 / 10", focus: 50, break: 10, cycles: 3, basis: "50-minute class / lecture rhythm" },
  { id: "hour", label: "60 / 10", focus: 60, break: 10, cycles: 3, basis: "Hour block" },
  { id: "sprint20", label: "20 / 5", focus: 20, break: 5, cycles: 6, basis: "Short focus sprint" },
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
  const [dtReady, setDtReady] = useState(false);
  const [dt, setDt] = useState<DesktopState | null>(null);
  const [shieldBusy, setShieldBusy] = useState(false);
  const isDesktop = Boolean(dt?.available);

  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [exceeded, setExceeded] = useState(0);
  const [extReady, setExtReady] = useState(false);
  const [suggestions, setSuggestions] = useState<HistorySuggestion[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [devices, setDevices] = useState<
    Array<{ id: string; kind: string; label: string; last_seen: string; shield_on: number }>
  >([]);
  const toast = useToast();
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
        if (pf) setPrefs(mergeBlockerSettings(pf));
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/blocker/config?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.sites) setSites(json.sites);
        if (json.settings) setPrefs(mergeBlockerSettings(json.settings));
        if (Array.isArray(json.devices)) setDevices(json.devices);
        // heartbeat web device
        fetch("/api/blocker/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            action: "heartbeat",
            kind: "web",
            label: "Web app",
            shieldOn: false,
            deviceId: localStorage.getItem("ff-device-id") || undefined,
          }),
        })
          .then((r) => r.json())
          .then((j) => {
            if (j.device?.id) localStorage.setItem("ff-device-id", j.device.id);
          })
          .catch(() => {});
        setLoading(false);
        return;
      }
    } catch {
      /* fall through */
    }
    const [bl, pf] = await Promise.all([
      fetch(`/api/blocklist?token=${encodeURIComponent(token)}`).then((r) => r.json()),
      fetch(`/api/prefs?token=${encodeURIComponent(token)}`).then((r) => r.json()),
    ]);
    if (bl.sites) setSites(bl.sites);
    if (pf.prefs) setPrefs(mergeBlockerSettings(pf.prefs));
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
    if (dt.shieldOn) {
      const ok = await requestHardUnlock(prefs, "Turn Shield OFF");
      if (!ok) {
        toast.error("Unlock cancelled");
        return;
      }
      if (token) {
        fetch("/api/blocker/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action: "bypass", kind: "shield_off" }),
        }).catch(() => {});
      }
    }
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
    const merged = mergeBlockerSettings(next);
    setPrefs(merged);
    if (!token) {
      localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(merged));
      return;
    }
    await fetch(`/api/blocker/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, settings: merged }),
    }).catch(() => {});
  }

  async function pushListToExtension(): Promise<boolean> {
    return connectExtension({
      apiUrl: window.location.origin,
      token: token || "",
      code: code || "",
      name: name || "",
      sites: sites.map((s) => s.site),
      prefs,
    });
  }

  async function connectChrome() {
    const ok = await pushListToExtension();
    if (ok) {
      setExtReady(true);
      await extensionCommand("setShield", { on: true });
      toast.ok("Blocking in Chrome");
      return;
    }
    if (token) {
      try {
        const res = await fetch("/api/blocker/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (res.ok && json.pairUrl) {
          window.open(json.pairUrl, "_blank", "noopener,noreferrer");
          toast.info("Finish pairing in the new tab");
          return;
        }
      } catch {
        /* fall through */
      }
    }
    toast.error("Install extension", "chrome://extensions → Load unpacked → extension folder");
  }

  // ── Focus timer ────────────────────────────────────────
  const focusTotalSec = prefs.focus_min * 60;

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

  const start = () => {
    void (async () => {
      startPhase("focus", 1);
      if (!isDesktop) {
        const ready = extReady || (await pingExtension(600));
        if (ready) {
          setExtReady(true);
          await pushListToExtension();
          await extensionCommand("setShield", { on: true });
          await extensionCommand("startFocus");
        } else {
          toast.error("Not blocking", "Tap Connect Chrome first.");
        }
      }
    })();
  };
  const stop = useCallback(() => {
    void (async () => {
      if (phase !== "idle") {
        const ok = await requestHardUnlock(prefs, "Stop the timer");
        if (!ok) {
          toast.error("Unlock cancelled");
          return;
        }
        if (token) {
          fetch("/api/blocker/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, action: "bypass", kind: "stop_timer" }),
          }).catch(() => {});
        }
        extensionCommand("stopFocus").catch(() => {});
      }
      stopTimer();
      stopAlarm();
      setPhase("idle");
      setRemaining(0);
      setCycle(0);
      setExceeded(0);
      desktopBridge.hideFloatTimer();
    })();
  }, [stopTimer, stopAlarm, prefs, phase, token, toast]);

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

  useEffect(() => {
    pingExtension().then(setExtReady);
    const onReady = (e: MessageEvent) => {
      if (e.data?.source === "fellowship-focus-ext" && e.data.type === "FF_EXT_READY") {
        setExtReady(true);
      }
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/blocker/suggestions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.suggestions?.length) return;
        setSuggestions(
          json.suggestions.map((s: { domain: string; visits: number; score: number; last_visit?: number }) => ({
            domain: s.domain,
            visits: s.visits,
            score: s.score,
            lastVisit: s.last_visit,
          }))
        );
      })
      .catch(() => {});
  }, [token]);

  async function scanHistory() {
    setScanBusy(true);
    try {
      const list = await analyzeHistoryViaExtension(30);
      setSuggestions(list);
      setExtReady(true);
      if (token && list.length) {
        await fetch("/api/blocker/suggestions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            domains: list.map((d) => ({
              domain: d.domain,
              visits: d.visits,
              lastVisit: d.lastVisit,
            })),
          }),
        }).catch(() => {});
      }
      toast.ok(
        list.length ? `${list.length} distractors found` : "No distractors found",
        "From your Chrome history (local only)."
      );
    } catch (e) {
      setExtReady(false);
      toast.error(
        "Couldn’t scan history",
        e instanceof Error ? e.message : "Install / reload the Fellowship Focus extension."
      );
    } finally {
      setScanBusy(false);
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (loading) return <p className="animate-pulse text-sm text-white/50">Loading…</p>;

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

    <div className="space-y-4">
        <div className="glass-panel flex flex-wrap items-center gap-3 px-4 py-3">
          {isDesktop ? (
            <>
              <div className="mr-auto">
                <p className="text-sm font-semibold text-white">Shield {on ? "ON" : "OFF"}</p>
                <p className="text-[11px] text-white/45">{sites.length} sites</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={shieldBusy || !dt?.certReady}
                onClick={toggleShield}
                className={`relative h-9 w-16 shrink-0 rounded-full transition disabled:opacity-40 ${
                  on ? "bg-[#b8422e]" : "bg-white/20"
                }`}
              >
                <span className={`absolute top-1 h-7 w-7 rounded-full bg-white transition-all ${on ? "left-8" : "left-1"}`} />
              </button>
            </>
          ) : (
            <>
              <div className="mr-auto">
                <p className="text-sm font-semibold text-white">
                  {extReady ? "Chrome ready" : "Not blocking yet"}
                </p>
                <p className="text-[11px] text-white/45">
                  {extReady ? `${sites.length} sites · Start or Connect` : "Connect Chrome to block"}
                </p>
              </div>
              <button type="button" onClick={connectChrome} className="btn-primary shrink-0">
                Connect Chrome
              </button>
            </>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,400px)_1fr]">
          <div className="glass-panel overflow-hidden">
            {inSession && (
              <div className={`px-5 pt-5 text-center ${remaining === 0 ? "text-[#f87171]" : "text-white"}`}>
                <div className="font-display text-5xl font-bold tabular-nums">{mm}:{ss}</div>
                <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/45">
                  {phase} · {cycle}/{prefs.cycles}
                </p>
              </div>
            )}
            <div className="border-b border-white/10 px-5 py-4">
              <div className="mb-3 flex flex-wrap gap-1">
                {TIMER_PRESETS.map((tp) => {
                  const active =
                    prefs.focus_min === tp.focus &&
                    prefs.break_min === tp.break &&
                    prefs.cycles === tp.cycles;
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      title={tp.basis}
                      disabled={inSession}
                      onClick={() =>
                        savePrefs({
                          ...prefs,
                          focus_min: tp.focus,
                          break_min: tp.break,
                          cycles: tp.cycles,
                          focus_sec: 0,
                        })
                      }
                      className={`rounded-md border px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${
                        active
                          ? "border-[#b8422e] bg-[#b8422e] text-white"
                          : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      {tp.label}
                    </button>
                  );
                })}
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <Stepper label="Focus" value={prefs.focus_min} min={1} max={180} suffix="min" disabled={inSession} onChange={(v) => savePrefs({ ...prefs, focus_min: v })} />
                <Stepper label="Break" value={prefs.break_min} min={0} max={60} suffix="min" disabled={inSession} onChange={(v) => savePrefs({ ...prefs, break_min: v })} />
                <Stepper label="Cycles" value={prefs.cycles} min={1} max={12} disabled={inSession} onChange={(v) => savePrefs({ ...prefs, cycles: v })} />
              </div>
              <div className="flex justify-end">
                {phase === "idle" ? (
                  <button onClick={start} className="btn-primary px-5">Start</button>
                ) : (
                  <button onClick={stop} className="btn-secondary px-5">Stop</button>
                )}
              </div>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap gap-1">
                {ALARM_OPTS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => savePrefs({ ...prefs, alarm_secs: o.id })}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      prefs.alarm_secs === o.id
                        ? "border-[#b8422e] bg-[#b8422e] text-white"
                        : "border-white/15 text-white/70"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
                <button type="button" onClick={testAlarm} className="btn-secondary py-1! text-xs!">Test</button>
              </div>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={1} step={0.01} value={prefs.alarm_vol} onChange={(e) => savePrefs({ ...prefs, alarm_vol: Number(e.target.value) })} className="h-1.5 flex-1 accent-[#b8422e]" />
                <button
                  type="button"
                  onClick={() => savePrefs({ ...prefs, anti_oops: !prefs.anti_oops })}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    prefs.anti_oops ? "border-[#b8422e] text-white" : "border-white/15 text-white/50"
                  }`}
                >
                  Anti-Oops
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5">
            <p className="mb-3 text-sm font-semibold text-white">Block list · {sites.length}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const active = presetSites(p.cats).every((s) => blockedSet.has(s));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePreset(p)}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                      active
                        ? "border-[#b8422e] bg-[#b8422e]/25 text-white"
                        : "border-white/15 bg-black/30 text-white/80 hover:bg-black/40"
                    }`}
                  >
                    {active ? "✓ " : ""}{p.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {CATEGORIES.map((c) => {
                const active = c.sites.every((s) => blockedSet.has(s));
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      active ? "border-[#b8422e] bg-[#b8422e]/20 text-white" : "border-white/15 text-white/60"
                    }`}
                  >
                    {active ? "✓ " : ""}{c.label}
                  </button>
                );
              })}
            </div>
            <form onSubmit={addCustom} className="mt-3 flex gap-2">
              <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add site…" className="input-premium flex-1 bg-white/5 py-1.5 text-sm" />
              <button type="submit" className="btn-primary">Add</button>
            </form>
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
              {sites.length === 0 ? (
                <li className="text-xs text-white/40">Pick a preset above.</li>
              ) : (
                sites.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1.5">
                    <span className="flex-1 truncate text-sm text-white/85">{s.site}</span>
                    <button onClick={() => removeSite(s.site)} className="text-white/40 hover:text-red-400" aria-label={`Remove ${s.site}`}>✕</button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <details className="glass-panel overflow-hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm text-white/70 hover:text-white [&::-webkit-details-marker]:hidden">
            More · lock, schedule, allowlist, history
          </summary>
          <BlockerControls
            settings={prefs}
            onChange={(next) => savePrefs(next)}
            sites={sites.map((s) => s.site)}
            devices={devices}
            onImportSites={(list) => post({ action: "add", sites: list, category: "import" })}
            suggestions={suggestions}
            onScanHistory={scanHistory}
            scanBusy={scanBusy}
            disabled={inSession}
            onCoachApply={(blocklist, presetId) => {
              post({ action: "add", sites: blocklist, category: "ai" });
              const tp = TIMER_PRESETS.find((t) => t.id === presetId);
              if (tp) {
                savePrefs({
                  ...prefs,
                  focus_min: tp.focus,
                  break_min: tp.break,
                  cycles: tp.cycles,
                });
              }
              toast.ok("Applied");
            }}
          />
        </details>
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
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const commit = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") {
      onChange(min);
      setDraft(String(min));
      return;
    }
    const n = clamp(parseInt(digits, 10));
    onChange(n);
    setDraft(String(n));
  };
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
        <div className="flex min-w-12 flex-1 flex-col items-center justify-center px-1">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={disabled}
            value={editing ? draft : String(value)}
            aria-label={label ? `${label} value` : "Value"}
            onFocus={(e) => {
              setEditing(true);
              setDraft(String(value));
              e.target.select();
            }}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, "");
              setDraft(next);
            }}
            onBlur={() => {
              commit(draft);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setDraft(String(value));
                setEditing(false);
                e.currentTarget.blur();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                inc();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                dec();
              }
            }}
            className="w-full bg-transparent text-center text-lg font-semibold tabular-nums leading-none text-white outline-none disabled:cursor-not-allowed"
          />
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

