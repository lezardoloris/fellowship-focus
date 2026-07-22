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

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

type Device = { id: string; kind: string; label: string; last_seen: string; shield_on: number };

/** Compact advanced controls — keep out of the main Block viewport. */
export function BlockerControls({
  settings,
  onChange,
  sites,
  devices,
  onImportSites,
  onCoachApply,
  suggestions,
  onScanHistory,
  scanBusy,
  disabled,
}: {
  settings: BlockerSettings;
  onChange: (next: BlockerSettings) => void;
  sites: string[];
  devices: Device[];
  onImportSites: (sites: string[]) => void;
  onCoachApply: (blocklist: string[], preset?: string) => void;
  suggestions: Array<{ domain: string; visits: number; score: number }>;
  onScanHistory: () => void;
  scanBusy?: boolean;
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
    if (!settings.allowlist.includes(d)) patch({ allowlist: [...settings.allowlist, d] });
    setAllowDraft("");
  }

  function addWorkdaySchedule() {
    const rule: ScheduleRule = {
      id: `sch-${Date.now()}`,
      label: "Work",
      days: [1, 2, 3, 4, 5],
      start: "09:00",
      end: "18:00",
      locked: false,
    };
    patch({ schedules: [...settings.schedules, rule] });
  }

  function quickLock(hours: number) {
    patch({ quick_lock_until: new Date(Date.now() + hours * 3600 * 1000).toISOString() });
    toast.ok(`Locked ${hours < 1 ? "30m" : `${hours}h`}`);
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
      if (!res.ok) throw new Error(json.error || "failed");
      if (Array.isArray(json.coach?.blocklist)) onCoachApply(json.coach.blocklist, json.coach.preset);
      toast.ok("Plan applied");
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
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/50">Lock</span>
        {[0.5, 1, 2, 4].map((h) => (
          <button
            key={h}
            type="button"
            disabled={disabled}
            onClick={() => quickLock(h)}
            className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            {h < 1 ? "30m" : `${h}h`}
          </button>
        ))}
        {force.on && (
          <button type="button" onClick={() => patch({ quick_lock_until: null })} className="text-xs text-white/40 underline">
            clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/50">Hard</span>
        {hardModes.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => patch({ hard_mode: m.id })}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              settings.hard_mode === m.id
                ? "border-[#b8422e] bg-[#b8422e] text-white"
                : "border-white/15 text-white/70"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/50">Schedule</span>
        <button type="button" onClick={addWorkdaySchedule} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/80">
          + Work 9–18
        </button>
        {settings.schedules.map((r) => (
          <button
            key={r.id}
            type="button"
            title="Remove"
            onClick={() => patch({ schedules: settings.schedules.filter((s) => s.id !== r.id) })}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/55"
          >
            {r.days.map((d) => DAY_LABELS[d]).join("")} {r.start}–{r.end} ✕
          </button>
        ))}
      </div>

      <div>
        <form onSubmit={addAllow} className="flex gap-2">
          <input
            value={allowDraft}
            onChange={(e) => setAllowDraft(e.target.value)}
            placeholder="Allow domain…"
            className="input-premium flex-1 bg-white/5 py-1.5 text-sm"
          />
          <button type="submit" className="btn-primary py-1.5! text-xs!">
            Allow
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1">
          {settings.allowlist.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => patch({ allowlist: settings.allowlist.filter((x) => x !== d) })}
              className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60"
            >
              {d} ✕
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onScanHistory} disabled={scanBusy} className="btn-secondary text-xs">
          {scanBusy ? "…" : "Scan history"}
        </button>
        <button type="button" onClick={runCoach} disabled={coachBusy} className="btn-secondary text-xs">
          {coachBusy ? "…" : "AI coach"}
        </button>
        <button type="button" onClick={exportConfig} className="btn-secondary text-xs">
          Export
        </button>
        <label className="btn-secondary cursor-pointer text-xs">
          Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const json = JSON.parse(String(reader.result));
                  if (json.settings) onChange({ ...settings, ...json.settings });
                  if (Array.isArray(json.sites)) onImportSites(json.sites.map(String));
                  toast.ok("Imported");
                } catch {
                  toast.error("Bad file");
                }
              };
              reader.readAsText(f);
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-white/50">
          Friction
          <input
            type="number"
            min={3}
            max={30}
            value={settings.friction_secs}
            onChange={(e) => patch({ friction_secs: Number(e.target.value) || 8 })}
            className="input-premium w-14 bg-white/5 py-1 text-xs"
          />
          s
        </label>
      </div>

      {suggestions.length > 0 && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {suggestions.slice(0, 8).map((s) => (
            <li key={s.domain} className="truncate text-xs text-white/50">
              {s.domain} · {s.visits}
            </li>
          ))}
        </ul>
      )}

      {devices.length > 0 && (
        <p className="text-[10px] text-white/35">
          Devices: {devices.map((d) => `${d.kind}${d.shield_on ? "●" : ""}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

export async function requestHardUnlock(
  settings: BlockerSettings,
  actionLabel: string
): Promise<boolean> {
  if (settings.hard_mode === "off") {
    if (settings.anti_oops) return window.confirm(`${actionLabel}?`);
    return true;
  }
  if (settings.hard_mode === "confirm") {
    return window.confirm(`${actionLabel}?`);
  }
  if (settings.hard_mode === "delay") {
    const secs = Math.max(5, settings.hard_delay_secs || 30);
    if (!window.confirm(`${actionLabel}? Wait ${secs}s.`)) return false;
    await new Promise((r) => setTimeout(r, secs * 1000));
    return window.confirm(`Still ${actionLabel.toLowerCase()}?`);
  }
  if (settings.hard_mode === "phrase") {
    const phrase = settings.hard_phrase || "i will focus";
    const typed = window.prompt(`Type “${phrase}”:`);
    return (typed || "").trim().toLowerCase() === phrase.trim().toLowerCase();
  }
  return false;
}
