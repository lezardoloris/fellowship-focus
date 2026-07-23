"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { desktopBridge, isDesktopShell, type DesktopState } from "@/lib/desktop";
import { playAlarm } from "@/lib/alarm";
import { logSoloSession } from "@/lib/soloStats";
import {
  analyzeHistoryViaExtension,
  connectExtension,
  extensionCommand,
  getExtensionState,
  isArmed,
  pingExtension,
  type ExtensionState,
  type HistorySuggestion,
} from "@/lib/extensionBridge";
import { useToast } from "@/components/Toasts";
import { PremiumLoader } from "@/components/PremiumLoader";
import { FocusMusicPanel } from "@/components/FocusMusicPanel";
import { requestHardUnlock } from "@/components/BlockerControls";
import { usePublishBlockerMode } from "@/components/BlockerMode";
import { OnboardingCard } from "@/components/OnboardingCard";
import {
  DEFAULT_BLOCKER_SETTINGS,
  mergeBlockerSettings,
  type BlockerSettings,
} from "@/lib/blockerSettings";
import {
  DEFAULT_BLOCK_LAYOUT,
  LAYOUT_LABELS,
  areaForPanel,
  musicCompactFor,
  readBlockLayout,
  setLayoutId,
  swapTimerMusic,
  writeBlockLayout,
  type BlockLayoutId,
  type BlockLayoutPrefs,
} from "@/lib/blockLayout";

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

/** Compact 80/20 timer presets — default first (50/10). */
const TIMER_PRESETS: Array<{
  id: string;
  label: string;
  focus: number;
  break: number;
  cycles: number;
  basis: string;
}> = [
  { id: "flow50", label: "50 / 10", focus: 50, break: 10, cycles: 3, basis: "Default · lecture rhythm" },
  { id: "pomodoro", label: "25 / 5", focus: 25, break: 5, cycles: 4, basis: "Pomodoro" },
  { id: "desk52", label: "52 / 17", focus: 52, break: 17, cycles: 3, basis: "DeskTime" },
  { id: "ultradian", label: "90 / 20", focus: 90, break: 20, cycles: 2, basis: "Ultradian" },
];

function presetSites(cats: string[]): string[] {
  const set = new Set<string>();
  for (const c of CATEGORIES) if (cats.includes(c.id)) c.sites.forEach((s) => set.add(s));
  return [...set];
}

type Phase = "idle" | "focus" | "break";

const LOCAL_BL_KEY = "ff-local-blocklist";
const LOCAL_PREFS_KEY = "ff-local-prefs";
/** Live session, persisted so a closed window/tab doesn't lose the deep-work clock. */
const SESSION_KEY = "ff-focus-session";

type StoredSession = {
  phase: Exclude<Phase, "idle">;
  cycle: number;
  endsAt: number;
  /** Frozen remaining seconds while paused (endsAt is ignored until resume). */
  remaining?: number;
  paused?: boolean;
  /** Focus hit 0 — waiting for break / snooze / extend. */
  awaitingBreak?: boolean;
};

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (s.phase !== "focus" && s.phase !== "break") return null;
    if (s.awaitingBreak && s.phase === "focus") {
      return { ...s, remaining: 0, paused: false, awaitingBreak: true };
    }
    if (s.paused) {
      const left = Math.max(0, Math.floor(Number(s.remaining) || 0));
      if (left <= 0) return null;
      return { ...s, remaining: left, paused: true };
    }
    if (!s?.endsAt) return null;
    return s;
  } catch {
    return null;
  }
}

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
  // Inside the desktop webview a Chrome extension can never exist — prefer desktop UI.
  const useDesktopUi = isDesktop || isDesktopShell();

  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [exceeded, setExceeded] = useState(0);
  const [extReady, setExtReady] = useState(false);
  const [extState, setExtState] = useState<ExtensionState | null>(null);
  // Arming failed once: offer an explicit unprotected start rather than
  // trapping the user with a timer that refuses to run (desktop webview,
  // Firefox, extension not installed…).
  const [armFailed, setArmFailed] = useState(false);
  const [floatHidden, setFloatHidden] = useState(false);
  const [floatExpanded, setFloatExpanded] = useState(false);
  const [awaitingBreak, setAwaitingBreak] = useState(false);
  const [siteQuery, setSiteQuery] = useState("");
  const [suggestions, setSuggestions] = useState<HistorySuggestion[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [devices, setDevices] = useState<
    Array<{ id: string; kind: string; label: string; last_seen: string; shield_on: number }>
  >([]);
  const [blockLayout, setBlockLayout] = useState<BlockLayoutPrefs>(DEFAULT_BLOCK_LAYOUT);
  const [unprotectedPrompt, setUnprotectedPrompt] = useState(false);
  const [connectChooser, setConnectChooser] = useState(false);
  const [creditPrompt, setCreditPrompt] = useState<{
    phase: Exclude<Phase, "idle">;
    cycle: number;
    minutes: number;
  } | null>(null);
  const toast = useToast();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAlarmRef = useRef<(() => void) | null>(null);
  const endsAtRef = useRef<number>(0);
  const firedRef = useRef(false);
  // Always read the freshest list when talking to the extension: a stale closure
  // silently pushed a list missing the site the user had just added.
  const sitesRef = useRef<BlocklistEntry[]>([]);
  const prefsRef = useRef<Prefs>(prefs);

  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    setBlockLayout(readBlockLayout());
  }, []);

  const persistLayout = useCallback((next: BlockLayoutPrefs) => {
    const saved = writeBlockLayout(next);
    setBlockLayout(saved);
  }, []);

  const applyDesktopState = useCallback((st: DesktopState) => {
    setDt(st);
    // Never clobber a good list with an empty poll (arming gap / race). Music
    // and timer must not wipe sites via desktop state sync.
    if (Array.isArray(st.sites) && st.sites.length > 0) {
      setSites(st.sites.map((s) => ({ id: s, site: s, category: null })));
    }
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
  // Meanwhile hydrate local prefs immediately so the tab isn't blocked on the bridge.
  useEffect(() => {
    try {
      const bl = JSON.parse(localStorage.getItem(LOCAL_BL_KEY) || "[]") as BlocklistEntry[];
      if (Array.isArray(bl) && bl.length) setSites(bl);
      const pf = JSON.parse(localStorage.getItem(LOCAL_PREFS_KEY) || "null") as Partial<Prefs> | null;
      if (pf) setPrefs(mergeBlockerSettings(pf));
    } catch {
      /* ignore */
    }
    setLoading(false);

    let alive = true;
    const adopt = async () => {
      if (!alive || !desktopBridge.present()) return;
      const st = await desktopBridge.getState();
      if (!alive || !st.available) return;
      applyDesktopState(st);
    };
    desktopBridge.ready().then(async () => {
      if (!alive) return;
      await adopt();
      setDtReady(true);
    });
    // The WebChannel handshake can still land after the timeout; switching to
    // desktop mode late is far better than demanding a Chrome extension that
    // can never exist inside the desktop webview.
    window.addEventListener("ffdesktop-ready", adopt);
    return () => {
      alive = false;
      window.removeEventListener("ffdesktop-ready", adopt);
    };
  }, [applyDesktopState]);

  // Browser mode load (server or local) — skipped inside the desktop app.
  useEffect(() => {
    if (!dtReady || desktopBridge.present()) return;
    load();
  }, [dtReady, load]);

  // Settings panel may update prefs/sites — stay in sync.
  useEffect(() => {
    const onReload = () => {
      if (!desktopBridge.present()) load();
    };
    window.addEventListener("ff-blocker-reload", onReload);
    return () => window.removeEventListener("ff-blocker-reload", onReload);
  }, [load]);

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
        toast.info("Unlock cancelled");
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
    const turningOn = !dt.shieldOn;
    try {
      if (turningOn) {
        toast.info("Arming Shield…", "Waiting for the system proxy.");
      }
      const st = await desktopBridge.setShield(turningOn);
      applyDesktopState(st);
      if (!st.available) return;
      // Never toast OFF while still arming — wait for live/fail.
      if (turningOn) {
        if (st.arming) {
          // Poll until live or idle-off.
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 400));
            const poll = await desktopBridge.getState();
            if (poll.available) applyDesktopState(poll);
            if (poll.shieldOn && poll.active) {
              toast.ok("Shield ON");
              return;
            }
            if (!poll.arming && !(poll.shieldOn && poll.active)) {
              toast.error("Shield failed to arm", "Check the certificate in the Blocker tab.");
              return;
            }
          }
          toast.error("Still arming", "Shield has not confirmed live yet.");
        } else if (st.shieldOn && st.active) {
          toast.ok("Shield ON");
        } else {
          toast.error("Shield failed to arm");
        }
      } else {
        toast.ok(st.shieldOn ? "Shield ON" : "Shield OFF");
      }
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
      // Compute synchronously: a setSites(prev => …) updater runs on the next
      // render, so reading the result right after would push a stale list.
      const prev = sitesRef.current;
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
      sitesRef.current = next;
      setSites(next);
      await syncSitesToExtension();
      return;
    }
    const res = await fetch(`/api/blocklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
    const json = await res.json();
    if (json.sites) {
      setSites(json.sites);
      sitesRef.current = json.sites;
    }
    await syncSitesToExtension();
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
    setSiteQuery("");
  }

  async function savePrefs(next: Prefs) {
    const prev = prefsRef.current;
    const merged = mergeBlockerSettings(next);
    setPrefs(merged);
    prefsRef.current = merged;
    // Desktop setPrefs must stay field-scoped: timer/alarm/music writes must
    // NEVER push blocker_mode/block_style. The desktop bridge restarts mitm
    // (releases system proxy) when those fields change — a full-blob prefs
    // write on every focus_min tweak was disarming Shield for ~15s.
    const modeChanged = merged.blocker_mode !== prev.blocker_mode;
    const styleChanged = merged.block_style !== prev.block_style;
    if ((isDesktopShell() || isDesktop) && (modeChanged || styleChanged)) {
      const patch: Record<string, unknown> = {};
      if (modeChanged) patch.blocker_mode = merged.blocker_mode;
      if (styleChanged) patch.block_style = merged.block_style;
      const st = await desktopBridge.setPrefs(patch);
      if (st.available) setDt(st);
    }
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

  /** Connect + arm in one shot, using the freshest list. Returns real state. */
  const armExtension = useCallback(async (): Promise<ExtensionState | null> => {
    const state = await connectExtension({
      apiUrl: window.location.origin,
      token: token || "",
      code: code || "",
      name: name || "",
      sites: sitesRef.current.map((s) => s.site),
      prefs: prefsRef.current,
      shieldOn: true,
    });
    if (!state) return null;
    // connect() arms the shield itself, but confirm against real rules rather
    // than trusting the round-trip.
    if (!isArmed(state)) {
      await extensionCommand("setShield", { on: true });
      return await getExtensionState();
    }
    return state;
  }, [token, code, name]);

  /** Mirror the current list into the extension so rules rebuild immediately. */
  const syncSitesToExtension = useCallback(async () => {
    if (!extReady) return;
    await extensionCommand("setSites", { sites: sitesRef.current.map((s) => s.site) });
    setExtState(await getExtensionState());
  }, [extReady]);

  /** ON/OFF switch for the extension shield, mirroring the desktop toggle. */
  async function toggleExtensionShield() {
    if (shieldBusy) return;
    const turningOff = extArmed;
    if (turningOff) {
      const ok = await requestHardUnlock(prefs, "Turn Shield OFF");
      if (!ok) {
        toast.info("Unlock cancelled");
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
      if (turningOff) {
        const ok = await extensionCommand("setShield", { on: false });
        const st = await getExtensionState();
        setExtState(st);
        // The extension refuses to disarm during a focus session or a locked schedule.
        if (!ok || isArmed(st)) toast.error("Shield locked", "Stop the focus session first.");
        else toast.info("Shield OFF", "Sites are no longer blocked.");
        return;
      }
      const st = await armExtension();
      setExtState(st);
      if (st && isArmed(st)) {
        setExtReady(true);
        setArmFailed(false);
        toast.ok("Shield ON", `${st.ruleCount} rules active`);
      } else {
        toast.error(
          "Could not block",
          st?.siteCount === 0
            ? "Add a site first."
            : st
              ? "The extension could not install rules — reload it in chrome://extensions."
              : "No blocker found. Install the desktop app, or load the Chrome extension.",
        );
      }
    } finally {
      setShieldBusy(false);
    }
  }

  /**
   * The one button. Picks whichever engine is available and, when none is,
   * says exactly what is missing instead of sitting there greyed out.
   */
  async function blockNow() {
    if (shieldBusy) return;

    if (useDesktopUi) {
      if (!isDesktop) {
        toast.error("Blocker not connected", "The app is still starting. Try again in a second.");
        return;
      }
      if (!dt?.certReady) {
        toast.error(
          "Setup needed",
          "Open the Blocker tab in the app and install the certificate once.",
        );
        return;
      }
      await toggleShield();
      return;
    }

    if (!sites.length) {
      toast.error("Nothing to block", "Add a site or pick a preset first.");
      return;
    }
    await toggleExtensionShield();
  }

  const blockNowRef = useRef(blockNow);
  blockNowRef.current = blockNow;

  async function connectChrome() {
    const state = await armExtension();
    if (state && isArmed(state)) {
      setExtReady(true);
      setExtState(state);
      toast.ok("Shield ON in Chrome", `${state.ruleCount} rules active`);
      return;
    }
    if (state && !isArmed(state)) {
      // Extension is there but has nothing to block.
      setExtReady(true);
      setExtState(state);
      toast.error(
        "Nothing to block",
        state.siteCount === 0 ? "Add a site or pick a preset first." : "Shield could not arm."
      );
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
    toast.error("Install extension", "chrome://extensions → Load unpacked → fellowship-focus/extension");
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
    (p: Phase, cyc: number, resumeSecs?: number, opts?: { keepAlarm?: boolean }) => {
      if (!opts?.keepAlarm) stopAlarm();
      setExceeded(0);
      setPaused(false);
      setAwaitingBreak(false);
      setPhase(p);
      setCycle(cyc);
      if (p !== "idle") setFloatHidden(false);
      const full = p === "focus" ? Math.max(1, focusTotalSec) : Math.max(1, prefs.break_min * 60);
      const secs = resumeSecs ?? full;
      setRemaining(secs);
      firedRef.current = false;
      endsAtRef.current = Date.now() + secs * 1000;
      if (p !== "idle") {
        try {
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
              phase: p,
              cycle: cyc,
              endsAt: endsAtRef.current,
              paused: false,
              awaitingBreak: false,
            })
          );
        } catch {
          /* storage full / private mode — timer still runs in-memory */
        }
      }
    },
    [focusTotalSec, prefs.break_min, stopAlarm]
  );

  const persistSession = useCallback(
    (patch: {
      phase: Exclude<Phase, "idle">;
      cycle: number;
      endsAt: number;
      remaining?: number;
      paused?: boolean;
      awaitingBreak?: boolean;
    }) => {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(patch));
      } catch {
        /* ignore */
      }
    },
    []
  );

  const clearSession = useCallback(() => {
    endsAtRef.current = 0;
    setPaused(false);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Resume a session that outlived the window being closed.
  useEffect(() => {
    const s = readSession();
    if (!s) return;
    if (s.awaitingBreak && s.phase === "focus") {
      stopAlarm();
      setExceeded(0);
      setPhase("focus");
      setCycle(s.cycle);
      setRemaining(0);
      setPaused(false);
      setAwaitingBreak(true);
      setFloatHidden(false);
      firedRef.current = true;
      endsAtRef.current = Date.now();
      persistSession({
        phase: "focus",
        cycle: s.cycle,
        endsAt: endsAtRef.current,
        remaining: 0,
        awaitingBreak: true,
      });
      fireAlarm();
      return;
    }
    if (s.paused) {
      const left = Math.max(0, Math.floor(Number(s.remaining) || 0));
      if (left <= 0) {
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- rehydrating a
      // persisted paused session from localStorage is a mount-time sync.
      stopAlarm();
      setExceeded(0);
      setPhase(s.phase);
      setCycle(s.cycle);
      setRemaining(left);
      setPaused(true);
      setAwaitingBreak(false);
      setFloatHidden(false);
      firedRef.current = false;
      endsAtRef.current = Date.now() + left * 1000;
      persistSession({
        phase: s.phase,
        cycle: s.cycle,
        endsAt: endsAtRef.current,
        remaining: left,
        paused: true,
      });
      void extensionCommand("pauseFocus").catch(() => {});
      return;
    }
    const left = Math.ceil((s.endsAt - Date.now()) / 1000);
    if (left <= 0) {
      // Expired while away — offer credit instead of silent discard.
      const creditMins = Math.max(1, Math.round(prefs.focus_min) || 1);
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
      if (s.phase === "focus") {
        setCreditPrompt({ phase: s.phase, cycle: s.cycle, minutes: creditMins });
      }
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rehydrating a
    // persisted session from localStorage is exactly a mount-time sync.
    startPhase(s.phase, s.cycle, left);
    void (async () => {
      if (isDesktopShell()) return;
      await extensionCommand("startFocus", {
        remainingMs: left * 1000,
        cycle: s.cycle,
        webOwnsLog: true,
      }).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, []);

  const floatLabel = (left: number) => {
    if (awaitingBreak) return "REST?";
    if (paused) return "PAUSED";
    return phase === "focus" ? "FOCUS" : "BREAK";
  };

  const pushFloat = useCallback(
    (left: number) => {
      desktopBridge.showFloatTimer({
        remaining: left,
        phase,
        cycle,
        cycles: prefs.cycles,
        label: floatLabel(left),
        paused: paused || awaitingBreak,
        awaitingBreak,
        expanded: floatExpanded,
      });
    },
    // floatLabel closes over awaitingBreak/paused/phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, cycle, prefs.cycles, paused, awaitingBreak, floatExpanded]
  );

  useEffect(() => {
    if (phase === "idle") {
      stopTimer();
      desktopBridge.hideFloatTimer();
      return;
    }
    if (awaitingBreak || paused) {
      stopTimer();
      pushFloat(remaining);
      return;
    }

    timerRef.current = setInterval(() => {
      // Derive from the stored deadline, never by decrementing: background tabs
      // are throttled, so a counter would drift and under-report deep work.
      const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0) {
        pushFloat(left);
        return;
      }
      if (firedRef.current) return;
      firedRef.current = true;
      fireAlarm();
      if (phase === "focus") {
        logSession();
        if (cycle >= prefs.cycles) {
          setPhase("idle");
          setAwaitingBreak(false);
          clearSession();
          desktopBridge.hideFloatTimer();
          return;
        }
        // Do NOT auto-start break — ask first (prompt + expandable float).
        setRemaining(0);
        setAwaitingBreak(true);
        setFloatExpanded(true);
        persistSession({
          phase: "focus",
          cycle,
          endsAt: Date.now(),
          remaining: 0,
          awaitingBreak: true,
        });
        desktopBridge.showFloatTimer({
          remaining: 0,
          phase: "focus",
          cycle,
          cycles: prefs.cycles,
          label: "REST?",
          paused: true,
          awaitingBreak: true,
          expanded: true,
        });
        return;
      }
      startPhase("focus", cycle + 1);
    }, 1000);
    pushFloat(remaining);
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick only on phase/cycle/pause changes
  }, [
    phase,
    cycle,
    paused,
    awaitingBreak,
    prefs.cycles,
    startPhase,
    stopTimer,
    logSession,
    fireAlarm,
    clearSession,
    persistSession,
    pushFloat,
  ]);

  const takeBreakNow = useCallback(() => {
    if (phase !== "focus") return;
    setAwaitingBreak(false);
    // Fresh chime when choosing break after deferral; keep ringing if already playing.
    fireAlarm();
    startPhase("break", cycle, undefined, { keepAlarm: true });
    void extensionCommand("startFocus", {
      remainingMs: Math.max(1, prefs.break_min) * 60 * 1000,
      cycle,
      webOwnsLog: true,
    }).catch(() => {});
  }, [phase, cycle, prefs.break_min, fireAlarm, startPhase]);

  const extendFocusBy = useCallback(
    (minutes: number) => {
      if (phase === "idle") return;
      const add = Math.max(1, Math.round(minutes)) * 60;
      const base =
        awaitingBreak || remaining <= 0
          ? 0
          : Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      const secs = base + add;
      setAwaitingBreak(false);
      setPaused(false);
      stopAlarm();
      setRemaining(secs);
      firedRef.current = false;
      endsAtRef.current = Date.now() + secs * 1000;
      persistSession({
        phase: phase as Exclude<Phase, "idle">,
        cycle,
        endsAt: endsAtRef.current,
        remaining: secs,
        paused: false,
        awaitingBreak: false,
      });
      void extensionCommand("startFocus", {
        remainingMs: secs * 1000,
        cycle,
        webOwnsLog: true,
      }).catch(() => {});
    },
    [phase, remaining, awaitingBreak, cycle, stopAlarm, persistSession]
  );

  const snoozeBreak = useCallback(() => {
    // Keep focus/shield; ask again after 5 minutes.
    extendFocusBy(5);
  }, [extendFocusBy]);
  // Track exceeded seconds when sitting at 0 (infinite alarm style)
  useEffect(() => {
    if (phase === "idle" || paused || remaining > 0) {
      setExceeded(0);
      return;
    }
    const id = setInterval(() => setExceeded((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, remaining, paused]);

  const pause = useCallback(() => {
    if (phase === "idle" || paused || remaining <= 0 || awaitingBreak) return;
    const left = Math.max(
      0,
      Math.ceil((endsAtRef.current - Date.now()) / 1000)
    );
    const frozen = left > 0 ? left : remaining;
    setRemaining(frozen);
    setPaused(true);
    stopTimer();
    stopAlarm();
    persistSession({
      phase: phase as Exclude<Phase, "idle">,
      cycle,
      endsAt: Date.now() + frozen * 1000,
      remaining: frozen,
      paused: true,
    });
    extensionCommand("pauseFocus").catch(() => {});
    desktopBridge.showFloatTimer({
      remaining: frozen,
      phase,
      cycle,
      cycles: prefs.cycles,
      label: "PAUSED",
      paused: true,
      awaitingBreak: false,
      expanded: floatExpanded,
    });
  }, [
    phase,
    paused,
    remaining,
    awaitingBreak,
    cycle,
    prefs.cycles,
    stopTimer,
    stopAlarm,
    persistSession,
    floatExpanded,
  ]);

  const resume = useCallback(() => {
    if (phase === "idle" || !paused) return;
    const secs = Math.max(0, remaining);
    if (secs <= 0) {
      setPaused(false);
      return;
    }
    endsAtRef.current = Date.now() + secs * 1000;
    setPaused(false);
    firedRef.current = false;
    persistSession({
      phase: phase as Exclude<Phase, "idle">,
      cycle,
      endsAt: endsAtRef.current,
      remaining: secs,
      paused: false,
    });
    extensionCommand("resumeFocus").catch(() => {});
  }, [phase, paused, remaining, cycle, persistSession]);

  const beginFocusSession = useCallback(() => {
    try {
      localStorage.setItem("ff-started-once", "1");
    } catch {
      /* ignore */
    }
    startPhase("focus", 1);
    void extensionCommand("startFocus", {
      remainingMs: Math.max(1, focusTotalSec) * 1000,
      cycle: 1,
      webOwnsLog: true,
    }).catch(() => {});
  }, [startPhase, focusTotalSec]);

  const start = () => {
    void (async () => {
      // Desktop: arm shield first (or confirm unprotected).
      if (isDesktop || isDesktopShell()) {
        if (isDesktop && dt?.certReady && !(dt.shieldOn && dt.active)) {
          setShieldBusy(true);
          try {
            toast.info("Arming Shield…");
            const st = await desktopBridge.setShield(true);
            applyDesktopState(st);
            let live = Boolean(st.shieldOn && st.active);
            if (st.arming || !live) {
              for (let i = 0; i < 20 && !live; i++) {
                await new Promise((r) => setTimeout(r, 400));
                const poll = await desktopBridge.getState();
                if (poll.available) applyDesktopState(poll);
                live = Boolean(poll.shieldOn && poll.active);
                if (!poll.arming && !live) break;
              }
            }
            if (!live) {
              setUnprotectedPrompt(true);
              return;
            }
            toast.ok("Shield ON");
          } finally {
            setShieldBusy(false);
          }
        } else if (isDesktop && !dt?.certReady) {
          setUnprotectedPrompt(true);
          return;
        }
        beginFocusSession();
        return;
      }
      if (!sitesRef.current.length) {
        toast.info("Timer started", "No sites in your list, so nothing is blocked.");
        beginFocusSession();
        return;
      }
      if (!extReady && !extState) {
        setUnprotectedPrompt(true);
        return;
      }
      const state = await armExtension();
      setExtState(state);
      if (state && isArmed(state)) {
        setArmFailed(false);
        setExtReady(true);
        beginFocusSession();
        return;
      }
      setArmFailed(true);
      setUnprotectedPrompt(true);
    })();
  };
  const stop = useCallback(() => {
    void (async () => {
      // Stopping the timer must be one click — no reconfirm. Hard-unlock stays
      // for turning the shield OFF (accountability), not for ending a session.
      if (phase !== "idle" && token) {
        fetch("/api/blocker/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action: "bypass", kind: "stop_timer" }),
        }).catch(() => {});
      }
      await extensionCommand("stopFocus").catch(() => {});
      getExtensionState().then(setExtState);
      stopTimer();
      stopAlarm();
      clearSession();
      setPhase("idle");
      setRemaining(0);
      setCycle(0);
      setExceeded(0);
      setAwaitingBreak(false);
      setFloatExpanded(false);
      desktopBridge.hideFloatTimer();
    })();
  }, [stopTimer, stopAlarm, clearSession, phase, token]);

  useEffect(() => {
    const onClosed = () => {
      // Float × End session — tear down
      extensionCommand("stopFocus").catch(() => {});
      stopTimer();
      stopAlarm();
      clearSession();
      setPhase("idle");
      setRemaining(0);
      setCycle(0);
      setExceeded(0);
      setAwaitingBreak(false);
      setFloatExpanded(false);
      desktopBridge.hideFloatTimer();
    };
    const onAdd = (e: Event) => {
      const mins = Number((e as CustomEvent).detail?.minutes) || 5;
      extendFocusBy(mins);
    };
    const onBreak = () => takeBreakNow();
    const onSnooze = () => snoozeBreak();
    const onPause = () => pause();
    const onResume = () => resume();
    window.addEventListener("ff-float-closed", onClosed);
    window.addEventListener("ff-float-add-time", onAdd);
    window.addEventListener("ff-float-break-now", onBreak);
    window.addEventListener("ff-float-snooze", onSnooze);
    window.addEventListener("ff-float-pause", onPause);
    window.addEventListener("ff-float-resume", onResume);
    return () => {
      window.removeEventListener("ff-float-closed", onClosed);
      window.removeEventListener("ff-float-add-time", onAdd);
      window.removeEventListener("ff-float-break-now", onBreak);
      window.removeEventListener("ff-float-snooze", onSnooze);
      window.removeEventListener("ff-float-pause", onPause);
      window.removeEventListener("ff-float-resume", onResume);
    };
  }, [stopTimer, stopAlarm, clearSession, extendFocusBy, takeBreakNow, snoozeBreak, pause, resume]);
  useEffect(() => {
    // No extension can exist in the desktop webview — don't poll for one.
    if (isDesktop || isDesktopShell()) return;
    let alive = true;
    const refresh = async () => {
      const st = await getExtensionState();
      if (!alive) return;
      setExtState(st);
      if (st) setExtReady(true);
      else setExtReady(await pingExtension(600));
    };
    refresh();
    const onReady = (e: MessageEvent) => {
      if (e.data?.source === "fellowship-focus-ext" && e.data.type === "FF_EXT_READY") {
        setExtReady(true);
        refresh();
      }
    };
    window.addEventListener("message", onReady);
    // Keep the badge honest if the shield is changed from the popup.
    const id = setInterval(refresh, 5000);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("message", onReady);
    };
  }, [isDesktop]);

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

  const on = Boolean(dt?.shieldOn && dt?.active);
  const inSession = phase !== "idle";
  /** Idle or paused: show focus/break/cycles + presets. Hide while countdown runs. */
  const canEditTimer = phase === "idle" || paused;
  const activePresetId =
    TIMER_PRESETS.find(
      (tp) =>
        tp.focus === prefs.focus_min &&
        tp.break === prefs.break_min &&
        tp.cycles === prefs.cycles
    )?.id ?? null;
  const extArmed = isArmed(extState);
  // Whichever engine is in play, this is "are sites actually blocked right now".
  const shieldLive = useDesktopUi ? on : extArmed;
  // Engine boot window: not blocking yet, but not OFF either — say so.
  const shieldArming = Boolean(useDesktopUi && dt?.arming && !on);
  const shieldConnected = useDesktopUi || extReady;

  const publishToggle = useCallback(() => {
    void blockNowRef.current();
  }, []);

  const publishConnect = useCallback(() => {
    setConnectChooser(true);
  }, []);

  usePublishBlockerMode({
    live: shieldLive,
    arming: shieldArming,
    busy: shieldBusy || loading,
    connected: shieldConnected,
    toggle: publishToggle,
    connect: publishConnect,
  });

  if (loading) return <PremiumLoader full />;

  return (
    <>
    <OnboardingCard
      connected={shieldConnected}
      hasSites={sites.length > 0}
      shieldOn={shieldLive}
      startedOnce={phase !== "idle"}
    />
    {unprotectedPrompt && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
        <div className="glass-panel max-w-md space-y-4 p-6" role="dialog" aria-labelledby="ff-unprotected-title">
          <h2 id="ff-unprotected-title" className="font-display text-xl text-white">
            Shield not connected
          </h2>
          <p className="text-sm text-white/70">
            Start without blocking, or connect a Shield first. Unprotected sessions do not enforce your block list.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href="/download" className="btn-primary flex-1 text-center">
              Connect Windows app
            </a>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setUnprotectedPrompt(false);
                void connectChrome();
              }}
            >
              Connect Chrome extension
            </button>
          </div>
          <button
            type="button"
            className="w-full text-sm text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
            onClick={() => {
              setUnprotectedPrompt(false);
              toast.info("Timer started — unprotected");
              beginFocusSession();
            }}
          >
            Start without blocking
          </button>
          <button
            type="button"
            className="w-full text-xs text-white/40"
            onClick={() => setUnprotectedPrompt(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    )}
    {creditPrompt && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
        <div className="glass-panel max-w-md space-y-4 p-6" role="dialog" aria-labelledby="ff-credit-title">
          <h2 id="ff-credit-title" className="font-display text-xl text-white">
            Session finished while away
          </h2>
          <p className="text-sm text-white/70">
            Credit {creditPrompt.minutes} focus minutes to your guild, or discard.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                const mins = creditPrompt.minutes;
                setCreditPrompt(null);
                logSoloSession(mins);
                if (token) {
                  fetch(`/api/sessions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, minutes: mins, completed: true }),
                  }).catch(() => {});
                }
                toast.ok("Session credited", `+${mins} min`);
              }}
            >
              Credit session
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setCreditPrompt(null)}
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    )}
    {awaitingBreak && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-4">
        <div
          className="glass-panel max-w-md space-y-5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-labelledby="ff-break-title"
          aria-describedby="ff-break-desc"
        >
          <div className="space-y-2 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#e07a63]/90">
              Fellowship Focus
            </p>
            <h2 id="ff-break-title" className="font-display text-2xl text-white">
              The hour ends
            </h2>
            <p id="ff-break-desc" className="text-sm leading-relaxed text-white/70">
              Rest, or continue the quest?
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className="btn-primary w-full py-2.5" onClick={takeBreakNow}>
              Take break now
            </button>
            <button type="button" className="btn-secondary w-full py-2.5" onClick={snoozeBreak}>
              Remind in 5 minutes
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-secondary py-2.5"
                onClick={() => extendFocusBy(5)}
              >
                Extend +5 min
              </button>
              <button
                type="button"
                className="btn-secondary py-2.5"
                onClick={() => extendFocusBy(10)}
              >
                Extend +10 min
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-white/40">
            Shield stays armed until you stop the session
          </p>
        </div>
      </div>
    )}
    {connectChooser && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
        <div className="glass-panel max-w-sm space-y-4 p-6" role="dialog" aria-labelledby="ff-connect-title">
          <h2 id="ff-connect-title" className="font-display text-xl text-white">
            Connect Shield
          </h2>
          <p className="text-sm text-white/70">Pick how you want to block distracting sites.</p>
          <a href="/download" className="btn-primary block text-center" onClick={() => setConnectChooser(false)}>
            Windows app
          </a>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              setConnectChooser(false);
              void connectChrome();
            }}
          >
            Chrome extension
          </button>
          <button type="button" className="w-full text-xs text-white/40" onClick={() => setConnectChooser(false)}>
            Cancel
          </button>
        </div>
      </div>
    )}
    {inSession && !isDesktop && !floatHidden && (
      <div className="fixed bottom-5 right-5 z-[9999] w-[min(100vw-2.5rem,20rem)]">
        <div
          className={`overflow-hidden border border-white/12 bg-[#1a1c1e]/96 shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-[border-radius] ${
            floatExpanded ? "rounded-2xl" : "rounded-full"
          }`}
        >
          <div className="flex items-center gap-2 py-1.5 pl-3.5 pr-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                paused
                  ? "bg-white/40"
                  : awaitingBreak
                    ? "animate-pulse bg-[#e07a63]"
                    : phase === "break"
                      ? "animate-pulse bg-[#60a5fa]"
                      : "animate-pulse bg-[#b8422e]"
              }`}
            />
            <span
              className={`min-w-0 flex-1 font-sans text-[15px] font-semibold tabular-nums tracking-wide ${
                paused || awaitingBreak ? "text-white/55" : "text-[#f4f4f5]"
              }`}
            >
              {mm}:{ss}
              {awaitingBreak ? (
                <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#e07a63]/90">
                  Rest?
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setFloatExpanded((v) => !v)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2e3134] text-xs text-white/70 hover:bg-[#3a3d40] hover:text-white"
              aria-expanded={floatExpanded}
              aria-label={floatExpanded ? "Collapse timer" : "Expand timer"}
              title={floatExpanded ? "Collapse" : "Expand"}
            >
              {floatExpanded ? "▴" : "▾"}
            </button>
            <button
              type="button"
              onClick={() => setFloatHidden(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2e3134] text-base leading-none text-white/70 hover:bg-[#3a3d40] hover:text-white"
              aria-label="Hide timer"
              title="Hide timer — session keeps running (use Stop to end)"
            >
              ×
            </button>
          </div>
          {floatExpanded && (
            <div className="space-y-3 border-t border-white/10 px-3.5 pb-3.5 pt-3">
              <FocusMusicPanel compact />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn-secondary min-h-8 flex-1 px-2 py-1 text-xs"
                  onClick={() => extendFocusBy(5)}
                >
                  +5 min
                </button>
                <button
                  type="button"
                  className="btn-secondary min-h-8 flex-1 px-2 py-1 text-xs"
                  onClick={() => extendFocusBy(10)}
                >
                  +10 min
                </button>
              </div>
              {awaitingBreak ? (
                <div className="flex flex-col gap-1.5">
                  <button type="button" className="btn-primary min-h-8 py-1.5 text-xs" onClick={takeBreakNow}>
                    Break now
                  </button>
                  <button type="button" className="btn-secondary min-h-8 py-1.5 text-xs" onClick={snoozeBreak}>
                    Remind in 5 min
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {paused ? (
                    <button type="button" className="btn-primary min-h-8 flex-1 py-1.5 text-xs" onClick={resume}>
                      Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary min-h-8 flex-1 py-1.5 text-xs"
                      disabled={remaining <= 0}
                      onClick={pause}
                    >
                      Pause
                    </button>
                  )}
                  {phase === "focus" && (
                    <button
                      type="button"
                      className="btn-secondary min-h-8 flex-1 py-1.5 text-xs"
                      onClick={takeBreakNow}
                    >
                      Break now
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}

    <div className="space-y-4">
        {/* Nothing can block: say exactly how to fix it, and keep saying it.
            A toast vanishes and leaves the app looking simply broken. */}
        {!useDesktopUi && !extReady && (
          <div className="glass-panel flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
            <span className="font-semibold text-white">No blocker connected</span>
            <span className="text-white/70">
              A web page cannot block other tabs on its own.
            </span>
            <a href="/download" className="font-semibold text-[#e07a63] hover:underline">
              Get the app (blocks everything)
            </a>
            <span className="text-white/40">or</span>
            <a href="/extension" className="font-semibold text-[#e07a63] hover:underline">
              add the Chrome extension
            </a>
          </div>
        )}

        {/* Blocker Mode lives in the sticky header on every tab (product moat). */}

        {/* Session tools + Block list — named CSS grid areas (ff-block-layout-v1). */}
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-end gap-2">
          <label className="sr-only" htmlFor="ff-block-layout">
            Block layout
          </label>
          <select
            id="ff-block-layout"
            value={blockLayout.layoutId}
            onChange={(e) =>
              persistLayout(setLayoutId(blockLayout, e.target.value as BlockLayoutId))
            }
            className="input-premium py-1.5 text-xs"
            title="Rearrange Block panels"
          >
            {(Object.keys(LAYOUT_LABELS) as BlockLayoutId[]).map((id) => (
              <option key={id} value={id}>
                Layout · {LAYOUT_LABELS[id]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              persistLayout({
                ...blockLayout,
                areas: swapTimerMusic(blockLayout.areas),
              })
            }
            className="btn-secondary min-h-8 px-2.5 py-1 text-xs"
            title="Swap timer and music panels"
          >
            Swap timer / music
          </button>
          <button
            type="button"
            onClick={() => persistLayout(DEFAULT_BLOCK_LAYOUT)}
            className="btn-secondary min-h-8 px-2.5 py-1 text-xs"
            title="Reset to session top"
          >
            Reset
          </button>
        </div>

        <div
          className={`ff-block-layout ff-block-layout--${blockLayout.layoutId}`}
        >
          <div
            className={`glass-panel flex flex-col p-4 sm:p-5 ff-block-area-${areaForPanel(blockLayout.areas, "timer")}`}
          >
            <div
              className={`text-center ${
                inSession && remaining === 0
                  ? "text-[#f87171]"
                  : paused
                    ? "text-white/45"
                    : "text-white"
              }`}
            >
              <div className="ff-timer-digits font-display font-bold tracking-tight">
                {inSession
                  ? `${mm}:${ss}`
                  : `${String(prefs.focus_min).padStart(2, "0")}:00`}
              </div>
              {inSession ? (
                <p className="mt-2 text-xs tabular-nums tracking-[0.2em] text-white/50">
                  {paused ? "Paused · " : ""}
                  {cycle} / {prefs.cycles}
                  {phase === "break" ? " · break" : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs text-white/45">
                  {prefs.focus_min}m · {prefs.break_min}m · ×{prefs.cycles}
                </p>
              )}
            </div>

            {canEditTimer && (
              <div className="mt-4 space-y-3 sm:mt-5">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Timer presets">
                  {TIMER_PRESETS.map((tp) => {
                    const active = tp.id === activePresetId;
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        title={tp.basis}
                        onClick={() =>
                          savePrefs({
                            ...prefs,
                            focus_min: tp.focus,
                            break_min: tp.break,
                            cycles: tp.cycles,
                            focus_sec: 0,
                          })
                        }
                        className={`min-h-8 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? "border-[#b8422e] bg-[#b8422e]/25 text-white"
                            : "border-white/12 bg-white/[0.03] text-white/75 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        {tp.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stepper
                    label="Focus"
                    value={prefs.focus_min}
                    min={1}
                    max={180}
                    suffix="m"
                    compact
                    onChange={(v) => savePrefs({ ...prefs, focus_min: v })}
                  />
                  <Stepper
                    label="Break"
                    value={prefs.break_min}
                    min={0}
                    max={60}
                    suffix="m"
                    compact
                    onChange={(v) => savePrefs({ ...prefs, break_min: v })}
                  />
                  <Stepper
                    label="Cycles"
                    value={prefs.cycles}
                    min={1}
                    max={12}
                    compact
                    onChange={(v) => savePrefs({ ...prefs, cycles: v })}
                  />
                </div>
                {paused ? (
                  <p className="text-center text-xs text-white/40">
                    Next phase uses these · Resume keeps remaining time
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 sm:mt-5">
              <select
                value={prefs.alarm_secs}
                onChange={(e) => savePrefs({ ...prefs, alarm_secs: Number(e.target.value) })}
                className="input-premium min-w-0 flex-1 py-2 text-xs"
                aria-label="Alarm length"
                title="Alarm length"
              >
                {ALARM_OPTS.map((o) => (
                  <option key={o.id} value={o.id}>
                    Alarm · {o.label}
                  </option>
                ))}
              </select>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={prefs.alarm_vol}
                title="Alarm volume"
                aria-label="Alarm volume"
                onChange={(e) => savePrefs({ ...prefs, alarm_vol: Number(e.target.value) })}
                className="h-1 w-16 shrink-0 accent-[#b8422e] sm:w-20"
              />
            </div>

            {phase === "idle" ? (
              <button
                onClick={start}
                className="btn-primary mt-4 w-full py-2.5"
                title={armFailed ? "Blocking is not armed — the timer still runs" : undefined}
              >
                Start
              </button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {paused ? (
                  <button
                    type="button"
                    onClick={resume}
                    className="btn-primary py-2.5"
                    title="Continue from remaining time"
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pause}
                    className="btn-secondary py-2.5"
                    disabled={remaining <= 0}
                    title={remaining <= 0 ? "Nothing left to pause" : "Freeze countdown"}
                  >
                    Pause
                  </button>
                )}
                <button type="button" onClick={stop} className="btn-secondary py-2.5">
                  Stop
                </button>
              </div>
            )}
          </div>

          <div
            className={`glass-panel flex max-h-[min(70vh,34rem)] min-h-[12rem] flex-col overflow-hidden p-4 sm:p-5 ff-block-area-${areaForPanel(blockLayout.areas, "block")}`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                Block list
                <span className="ml-1.5 font-normal tabular-nums text-white/45">{sites.length}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex min-h-8 rounded-full border border-white/12 bg-black/35 p-0.5"
                  role="group"
                  aria-label="Block scope"
                >
                  {([
                    { id: "hard" as const, label: "Whole sites", tip: "Your list plus YouTube, Instagram, LinkedIn" },
                    { id: "soft" as const, label: "List only", tip: "Only domains on your list" },
                  ]).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      title={m.tip}
                      onClick={async () => {
                        await savePrefs({ ...prefs, blocker_mode: m.id });
                        prefsRef.current = { ...prefs, blocker_mode: m.id };
                        if (extReady) {
                          await armExtension();
                          setExtState(await getExtensionState());
                        }
                      }}
                      className={`min-h-8 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        prefs.blocker_mode === m.id
                          ? "bg-[#b8422e] text-white"
                          : "text-white/65 hover:text-white"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div
                  className="inline-flex min-h-8 rounded-full border border-white/12 bg-black/35 p-0.5"
                  role="group"
                  aria-label="Hit style"
                >
                  {([
                    { id: "page" as const, label: "Block page", tip: "Full interstitial (Chrome)" },
                    { id: "notify" as const, label: "Notify", tip: "Bounce tab + −XP toast (Chrome)" },
                  ]).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.tip}
                      onClick={async () => {
                        const next = { ...prefs, block_style: s.id };
                        await savePrefs(next);
                        prefsRef.current = next;
                        if (extReady) {
                          await armExtension();
                          setExtState(await getExtensionState());
                        }
                      }}
                      className={`min-h-8 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        prefs.block_style === s.id
                          ? "bg-[#b8422e] text-white"
                          : "text-white/65 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const active = presetSites(p.cats).every((s) => blockedSet.has(s));
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.desc}
                    onClick={() => togglePreset(p)}
                    className={`min-h-8 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? "border-[#b8422e] bg-[#b8422e]/25 text-white"
                        : "border-white/12 bg-white/[0.03] text-white/75 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              {CATEGORIES.map((c) => {
                const active = c.sites.every((s) => blockedSet.has(s));
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`min-h-8 rounded-full border px-2.5 py-1 text-xs transition ${
                      active
                        ? "border-[#b8422e]/80 bg-[#b8422e]/15 text-white"
                        : "border-transparent text-white/55 hover:bg-white/5 hover:text-white/85"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={addCustom} className="mt-3 flex gap-2">
              <input
                value={custom}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustom(v);
                  setSiteQuery(v);
                }}
                placeholder="Filter or add site…"
                className="input-premium flex-1 bg-white/5 py-2 text-sm"
              />
              <button type="submit" className="btn-primary shrink-0">
                Add
              </button>
            </form>

            {(() => {
              const q = siteQuery.trim().toLowerCase();
              const visible = q
                ? sites.filter((s) => s.site.includes(q))
                : sites;
              if (sites.length === 0) {
                return (
                  <div className="mt-3 flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/12 px-3 py-8 text-center text-xs text-white/45">
                    Pick a preset or add a site
                  </div>
                );
              }
              return (
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/8 bg-black/25 p-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {visible.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => removeSite(s.site)}
                        title={`Remove ${s.site}`}
                        className="group inline-flex max-w-full items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] py-1 pl-2 pr-1.5 text-xs text-white/80 transition hover:border-[#b8422e]/50 hover:bg-[#b8422e]/15 hover:text-white"
                      >
                        <span className="truncate">{s.site}</span>
                        <span className="shrink-0 text-white/35 group-hover:text-[#fca5a5]" aria-hidden>
                          ×
                        </span>
                      </button>
                    ))}
                    {visible.length === 0 ? (
                      <span className="px-1 py-2 text-xs text-white/45">No match</span>
                    ) : null}
                  </div>
                </div>
              );
            })()}
          </div>

          <FocusMusicPanel
            compact={musicCompactFor(blockLayout.layoutId)}
            className={`ff-block-area-${areaForPanel(blockLayout.areas, "music")}`}
          />
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
    <div className={compact ? "flex flex-col gap-1" : "flex flex-col gap-1.5"}>
      {label ? (
        <span
          className={`text-center font-medium uppercase tracking-wider text-white/55 text-xs`}
        >
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
          className={`flex items-center justify-center font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 ${
            compact ? "h-8 w-7 text-base" : "h-10 w-9 text-lg"
          }`}
          aria-label={`Decrease ${label || "value"}`}
        >
          −
        </button>
        <div className={`flex flex-1 flex-col items-center justify-center px-1 ${compact ? "min-w-10" : "min-w-12"}`}>
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
            className={`w-full bg-transparent text-center font-semibold tabular-nums leading-none text-white outline-none disabled:cursor-not-allowed ${
              compact ? "text-sm" : "text-lg"
            }`}
          />
          {suffix ? <span className="mt-0.5 text-xs text-white/55">{suffix}</span> : null}
        </div>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={inc}
          className={`flex items-center justify-center font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 ${
            compact ? "h-8 w-7 text-base" : "h-10 w-9 text-lg"
          }`}
          aria-label={`Increase ${label || "value"}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

