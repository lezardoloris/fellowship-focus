"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { BlockerControls } from "@/components/BlockerControls";
import { useToast } from "@/components/Toasts";
import {
  DEFAULT_BG_PREFS,
  loadBackgroundPrefs,
  saveBackgroundPrefs,
  type BackgroundPrefs,
} from "@/lib/backgroundPrefs";
import {
  DEFAULT_BLOCKER_SETTINGS,
  mergeBlockerSettings,
  type BlockerSettings,
} from "@/lib/blockerSettings";
import { PICKER_SCENE_IDS, SCENES, canonicalSceneId } from "@/lib/scenes";
import { analyzeHistoryViaExtension, type HistorySuggestion } from "@/lib/extensionBridge";

const LOCAL_PREFS_KEY = "ff-local-prefs";
const LOCAL_BL_KEY = "ff-local-blocklist";

type BlocklistEntry = { id: string; site: string; category: string | null };
type Device = { id: string; kind: string; label: string; last_seen: string; shield_on: number };

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SettingsPanel({
  open,
  onClose,
  bgPrefs,
  onBgPrefsChange,
  token,
  code,
  name,
}: {
  open: boolean;
  onClose: () => void;
  bgPrefs: BackgroundPrefs;
  onBgPrefsChange: (next: BackgroundPrefs) => void;
  token: string | null;
  code: string | null;
  name: string | null;
}) {
  const toast = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<BlockerSettings>(DEFAULT_BLOCKER_SETTINGS);
  const [sites, setSites] = useState<string[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [suggestions, setSuggestions] = useState<HistorySuggestion[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [oauthGithub, setOauthGithub] = useState(false);

  const reloadBlocker = useCallback(async () => {
    if (!token) {
      try {
        const pf = JSON.parse(localStorage.getItem(LOCAL_PREFS_KEY) || "null") as Partial<BlockerSettings> | null;
        if (pf) setSettings(mergeBlockerSettings(pf));
        const bl = JSON.parse(localStorage.getItem(LOCAL_BL_KEY) || "[]") as BlocklistEntry[];
        if (Array.isArray(bl)) setSites(bl.map((s) => s.site));
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const res = await fetch(`/api/blocker/config?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.settings) setSettings(mergeBlockerSettings(json.settings));
        if (json.sites) setSites((json.sites as BlocklistEntry[]).map((s) => s.site));
        if (Array.isArray(json.devices)) setDevices(json.devices);
      }
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    if (!open) return;
    reloadBlocker();
    fetch("/api/auth/providers-status")
      .then((r) => r.json())
      .then((j) => setOauthGithub(Boolean(j.github)))
      .catch(() => setOauthGithub(false));
  }, [open, reloadBlocker]);

  /* Focus trap + Escape + restore focus */
  useEffect(() => {
    if (!open) return;
    const root = panelRef.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    const first = focusables()[0];
    window.setTimeout(() => first?.focus(), 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  function patchBg(p: Partial<BackgroundPrefs>) {
    const scene = p.scene ? canonicalSceneId(p.scene) : bgPrefs.scene;
    const next = { ...bgPrefs, ...p, scene };
    saveBackgroundPrefs(next);
    onBgPrefsChange(next);
    if (p.scene) {
      const label = SCENES[scene]?.label ?? scene;
      toast.ok("Background", label);
    } else if (p.quality) {
      const labels = { high: "High", balanced: "Balanced", still: "Still" } as const;
      toast.ok("Background quality", labels[p.quality]);
    }
  }

  async function saveSettings(next: BlockerSettings) {
    const merged = mergeBlockerSettings(next);
    setSettings(merged);
    if (!token) {
      localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(merged));
    } else {
      try {
        const res = await fetch("/api/blocker/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, settings: merged }),
        });
        if (!res.ok) {
          toast.error("Save failed", "Could not sync blocker settings");
          return;
        }
      } catch {
        toast.error("Save failed", "Network error");
        return;
      }
    }
    window.dispatchEvent(new CustomEvent("ff-blocker-reload"));
  }

  async function importSites(list: string[]) {
    if (!token) {
      try {
        const bl = JSON.parse(localStorage.getItem(LOCAL_BL_KEY) || "[]") as BlocklistEntry[];
        const existing = new Set(bl.map((s) => s.site));
        const added = list
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s && !existing.has(s))
          .map((s) => ({ id: s, site: s, category: "import" as const }));
        const next = [...bl, ...added];
        localStorage.setItem(LOCAL_BL_KEY, JSON.stringify(next));
        setSites(next.map((s) => s.site));
      } catch {
        /* ignore */
      }
    } else {
      const res = await fetch("/api/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "add", sites: list, category: "import" }),
      });
      const json = await res.json();
      if (json.sites) setSites((json.sites as BlocklistEntry[]).map((s) => s.site));
    }
    window.dispatchEvent(new CustomEvent("ff-blocker-reload"));
  }

  async function scanHistory() {
    setScanBusy(true);
    try {
      const list = await analyzeHistoryViaExtension();
      setSuggestions(list);
      if (!list.length) toast.error("No history", "Install / connect the Chrome extension");
      else toast.ok(`Found ${list.length} sites`);
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanBusy(false);
    }
  }

  if (!open) return null;

  const selectedScene = canonicalSceneId(bgPrefs.scene);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16 md:pt-20"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="glass-panel relative w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ff-settings-title"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="ff-settings-title" className="font-display text-xl font-bold text-white">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {(name || code) && (
          <p className="mb-4 text-[11px] text-white/55">
            {name ? <span className="text-white/75">{name}</span> : null}
            {name && code ? " · " : null}
            {code ? <span>Guild {code}</span> : null}
          </p>
        )}

        <section className="space-y-3 border-b border-white/10 pb-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">Background</p>
          <p className="text-[11px] leading-relaxed text-white/60">
            One loop for the whole app — tabs won’t change it. Poster shows first; the loop fades in
            when ready.
          </p>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Background quality"
          >
            {(
              [
                { id: "high", label: "High", hint: "Full HD loop" },
                { id: "balanced", label: "Balanced", hint: "Lighter preload" },
                { id: "still", label: "Still", hint: "Poster only" },
              ] as const
            ).map((q) => {
              const selected = bgPrefs.quality === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  title={q.hint}
                  aria-pressed={selected}
                  onClick={() => patchBg({ quality: q.id })}
                  className={`min-h-9 rounded-md border px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 ${
                    selected
                      ? "border-[#b8422e] bg-[#b8422e]/20 text-white"
                      : "border-white/15 text-white/70 hover:border-white/35 hover:text-white"
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3" role="listbox" aria-label="Background scene">
            {PICKER_SCENE_IDS.map((id) => {
              const s = SCENES[id];
              const selected = selectedScene === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={s.label}
                  onClick={() => patchBg({ scene: id })}
                  className={`group relative aspect-video overflow-hidden rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 ${
                    selected
                      ? "border-[#b8422e] ring-1 ring-[#b8422e]"
                      : "border-white/15 hover:border-white/35"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.poster} alt="" className="h-full w-full object-cover" />
                  {s.video && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white/80">
                      ▶
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white/85">
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => patchBg({ scene: "map" })}
            aria-pressed={selectedScene === "map"}
            className={`relative mt-1 aspect-[3/1] w-full overflow-hidden rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 ${
              selectedScene === "map"
                ? "border-[#b8422e] ring-1 ring-[#b8422e]"
                : "border-white/15 hover:border-white/35"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SCENES.map.poster} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] text-white/85">
              Middle-earth map · still image
            </span>
          </button>
        </section>

        <section className="border-b border-white/10 py-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/70">
            Lock · schedule · allowlist
          </p>
          <p className="mb-3 text-[11px] text-white/55">
            Changes save immediately. Quick lock arms the shield until the timer ends.
          </p>
          <BlockerControls
            settings={settings}
            onChange={saveSettings}
            sites={sites}
            devices={devices}
            onImportSites={importSites}
            suggestions={suggestions}
            onScanHistory={scanHistory}
            scanBusy={scanBusy}
            onCoachApply={(blocklist) => {
              importSites(blocklist);
              toast.ok("Applied");
            }}
          />
        </section>

        {oauthGithub && (
          <section className="pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/70">GitHub</p>
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: "/app?tab=focus" })}
              className="btn-secondary text-xs"
            >
              Connect GitHub for coding track
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

export function useBackgroundPrefs() {
  const [bgPrefs, setBgPrefs] = useState<BackgroundPrefs>(DEFAULT_BG_PREFS);
  useEffect(() => {
    setBgPrefs(loadBackgroundPrefs());
  }, []);
  return [bgPrefs, setBgPrefs] as const;
}
