"use client";

import { useState } from "react";
import {
  type BlockerSettings,
  type HardMode,
  type ScheduleRule,
  normDomain,
  shieldForcedOn,
} from "@/lib/blockerSettings";
import { useToast } from "@/components/Toasts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Device = { id: string; kind: string; label: string; last_seen: string; shield_on: number };

export function BlockerControls({
  settings,
  onChange,
  token,
  sites,
  devices,
  onPairExtension,
  onImportSites,
  onCoachApply,
  suggestions,
  disabled,
}: {
  settings: BlockerSettings;
  onChange: (next: BlockerSettings) => void;
  token: string | null;
  sites: string[];
  devices: Device[];
  onPairExtension: () => void;
  onImportSites: (sites: string[]) => void;
  onCoachApply: (blocklist: string[], preset?: string) => void;
  suggestions: Array<{ domain: string; visits: number; score: number }>;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [allowDraft, setAllowDraft] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const force = shieldForcedOn(settings);

  function patch(p: Partial<BlockerSettings>) {
    onChange({ ...settings, ...p });
  }

  function addAllow(e: React.FormEvent) {
    e.preventDefault();
    const d = normDomain(allowDraft);
    if (!d) return;
    if (settings.allowlist.includes(d)) {
      toast.info("Already allowlisted");
      return;
    }
    patch({ allowlist: [...settings.allowlist, d] });
    setAllowDraft("");
  }

  function addWorkdaySchedule() {
    const rule: ScheduleRule = {
      id: `sch-${Date.now()}`,
      label: "Work hours",
      days: [1, 2, 3, 4, 5],
      start: "09:00",
      end: "18:00",
      locked: false,
    };
    patch({ schedules: [...settings.schedules, rule] });
    toast.ok("Schedule added", "Mon–Fri 09:00–18:00");
  }

  function quickLock(hours: number) {
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    patch({ quick_lock_until: until });
    toast.ok(`Locked ${hours}h`, "Shield stays on until the lock ends.");
  }

  function clearQuickLock() {
    if (force.locked && force.reason === "quick_lock") {
      // still need hard mode to clear — BlockTab handles unlock gate
    }
    patch({ quick_lock_until: null });
  }

  function exportConfig() {
    const blob = new Blob(
      [JSON.stringify({ settings, sites, exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fellowship-focus-blocker.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.ok("Exported");
  }

  function importConfig(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        if (json.settings) onChange({ ...settings, ...json.settings });
        if (Array.isArray(json.sites)) onImportSites(json.sites.map(String));
        toast.ok("Imported");
      } catch {
        toast.error("Invalid file");
      }
    };
    reader.readAsText(file);
  }

  async function runCoach() {
    if (!suggestions.length) {
      toast.error("Scan history first");
      return;
    }
    setCoachBusy(true);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: suggestions }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Coach failed");
      const coach = json.coach;
      toast.ok("AI plan ready", coach.advice || json.source);
      if (Array.isArray(coach.blocklist)) onCoachApply(coach.blocklist, coach.preset);
    } catch (e) {
      toast.error("Coach failed", e instanceof Error ? e.message : "");
    } finally {
      setCoachBusy(false);
    }
  }

  const hardModes: Array<{ id: HardMode; label: string }> = [
    { id: "off", label: "Off" },
    { id: "confirm", label: "Confirm" },
    { id: "delay", label: "Delay" },
    { id: "phrase", label: "Phrase" },
  ];

  return (
    <div className="space-y-5">
      {/* Quick lock */}
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto">
            <h2 className="text-base font-semibold text-white">Quick lock</h2>
            <p className="mt-1 text-xs text-white/55">
              Freedom-style commitment. Shield forced ON until the lock ends.
              {force.on ? (
                <span className="text-[#fca5a5]"> Active: {force.reason}</span>
              ) : null}
            </p>
          </div>
          {[0.5, 1, 2, 4].map((h) => (
            <button
              key={h}
              type="button"
              disabled={disabled}
              onClick={() => quickLock(h)}
              className="btn-secondary border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              {h < 1 ? "30m" : `${h}h`}
            </button>
          ))}
          {settings.quick_lock_until && (
            <button type="button" onClick={clearQuickLock} className="text-xs text-white/50 underline">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Hard mode */}
      <div className="glass-panel p-5">
        <h2 className="text-base font-semibold text-white">Hard mode</h2>
        <p className="mt-1 text-xs text-white/55">How hard is it to stop the timer or turn Shield OFF?</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hardModes.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => patch({ hard_mode: m.id })}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                settings.hard_mode === m.id
                  ? "border-[#b8422e] bg-[#b8422e] text-white"
                  : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {settings.hard_mode === "delay" && (
          <label className="mt-3 flex items-center gap-2 text-xs text-white/60">
            Delay (sec)
            <input
              type="number"
              min={5}
              max={300}
              value={settings.hard_delay_secs}
              onChange={(e) => patch({ hard_delay_secs: Number(e.target.value) || 30 })}
              className="input-premium w-20 bg-white/5 py-1"
            />
          </label>
        )}
        {settings.hard_mode === "phrase" && (
          <label className="mt-3 block text-xs text-white/60">
            Unlock phrase
            <input
              value={settings.hard_phrase}
              onChange={(e) => patch({ hard_phrase: e.target.value })}
              className="input-premium mt-1 w-full bg-white/5"
            />
          </label>
        )}
      </div>

      {/* Schedules */}
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h2 className="text-base font-semibold text-white">Schedules</h2>
            <p className="mt-1 text-xs text-white/55">Auto Shield by weekday hours.</p>
          </div>
          <button type="button" onClick={addWorkdaySchedule} className="btn-secondary text-xs">
            + Work hours
          </button>
        </div>
        {settings.schedules.length === 0 ? (
          <p className="mt-3 text-xs text-white/40">No schedules yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {settings.schedules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span className="flex-1 text-white/90">{r.label}</span>
                <span className="text-xs text-white/45">
                  {r.days.map((d) => DAY_LABELS[d]).join(" ")} · {r.start}–{r.end}
                  {r.locked ? " · locked" : ""}
                </span>
                <label className="flex items-center gap-1 text-[10px] text-white/50">
                  <input
                    type="checkbox"
                    checked={r.locked}
                    onChange={(e) =>
                      patch({
                        schedules: settings.schedules.map((s) =>
                          s.id === r.id ? { ...s, locked: e.target.checked } : s
                        ),
                      })
                    }
                  />
                  Lock
                </label>
                <button
                  type="button"
                  className="text-white/40 hover:text-red-400"
                  onClick={() => patch({ schedules: settings.schedules.filter((s) => s.id !== r.id) })}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Allowlist */}
      <div className="glass-panel p-5">
        <h2 className="text-base font-semibold text-white">Allowlist</h2>
        <p className="mt-1 text-xs text-white/55">Always reachable even when Shield is ON.</p>
        <form onSubmit={addAllow} className="mt-3 flex gap-2">
          <input
            value={allowDraft}
            onChange={(e) => setAllowDraft(e.target.value)}
            placeholder="github.com"
            className="input-premium flex-1 bg-white/5"
          />
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {settings.allowlist.map((d) => (
            <li key={d}>
              <button
                type="button"
                onClick={() => patch({ allowlist: settings.allowlist.filter((x) => x !== d) })}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:border-red-400/50"
              >
                {d} ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Friction */}
      <div className="glass-panel p-5">
        <h2 className="text-base font-semibold text-white">Friction mode (OneSec-style)</h2>
        <p className="mt-1 text-xs text-white/55">
          Soft sites wait {settings.friction_secs}s before opening. Mark sites as friction from the
          block list (coming on extension).
        </p>
        <label className="mt-3 flex items-center gap-2 text-xs text-white/60">
          Breath seconds
          <input
            type="number"
            min={3}
            max={30}
            value={settings.friction_secs}
            onChange={(e) => patch({ friction_secs: Number(e.target.value) || 8 })}
            className="input-premium w-20 bg-white/5 py-1"
          />
        </label>
      </div>

      {/* Pair + AI + export */}
      <div className="glass-panel p-5">
        <h2 className="text-base font-semibold text-white">Sync & intelligence</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onPairExtension} disabled={!token} className="btn-primary text-sm disabled:opacity-40">
            Pair extension (1-click)
          </button>
          <button type="button" onClick={runCoach} disabled={coachBusy} className="btn-secondary text-sm">
            {coachBusy ? "…" : "AI coach from history"}
          </button>
          <button type="button" onClick={exportConfig} className="btn-secondary text-sm">
            Export
          </button>
          <label className="btn-secondary cursor-pointer text-sm">
            Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importConfig(f);
              }}
            />
          </label>
        </div>
        {devices.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-white/40">Devices</p>
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs text-white/60">
                <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase">
                  {d.kind}
                </span>
                <span className="flex-1 text-white/80">{d.label}</span>
                <span>{d.shield_on ? "Shield ON" : "off"}</span>
                <span className="text-white/35">{d.last_seen}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Gate unlock attempts through hard mode. Returns true if allowed to proceed. */
export async function requestHardUnlock(
  settings: BlockerSettings,
  actionLabel: string
): Promise<boolean> {
  if (settings.hard_mode === "off") {
    if (settings.anti_oops) return window.confirm(`${actionLabel}?`);
    return true;
  }
  if (settings.hard_mode === "confirm") {
    return window.confirm(`${actionLabel}?\n\nHard mode: confirm.`);
  }
  if (settings.hard_mode === "delay") {
    const secs = Math.max(5, settings.hard_delay_secs || 30);
    const ok = window.confirm(`${actionLabel}?\nWait ${secs}s after OK.`);
    if (!ok) return false;
    await new Promise((r) => setTimeout(r, secs * 1000));
    return window.confirm(`Still want to ${actionLabel.toLowerCase()}?`);
  }
  if (settings.hard_mode === "phrase") {
    const phrase = settings.hard_phrase || "i will focus";
    const typed = window.prompt(`Type “${phrase}” to ${actionLabel.toLowerCase()}:`);
    return (typed || "").trim().toLowerCase() === phrase.trim().toLowerCase();
  }
  return false;
}
