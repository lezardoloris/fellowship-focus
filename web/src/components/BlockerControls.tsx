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

  function patch(p: Partial<BlockerSettings>, feedback?: string) {
    onChange({ ...settings, ...p });
    if (feedback) toast.ok(feedback);
  }

  function addAllow(e: React.FormEvent) {
    e.preventDefault();
    const d = normDomain(allowDraft);
    if (!d) return;
    if (settings.allowlist.includes(d)) {
      toast.info("Already allowed", d);
      setAllowDraft("");
      return;
    }
    patch({ allowlist: [...settings.allowlist, d] }, `Allowed ${d}`);
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
    patch({ schedules: [...settings.schedules, rule] }, "Schedule added");
  }

  function quickLock(hours: number) {
    patch(
      { quick_lock_until: new Date(Date.now() + hours * 3600 * 1000).toISOString() },
      `Locked ${hours < 1 ? "30m" : `${hours}h`}`
    );
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

  const hardModes: Array<{ id: HardMode; label: string; hint: string }> = [
    { id: "off", label: "Off", hint: "Confirm once" },
    { id: "confirm", label: "Confirm", hint: "Ask again" },
    { id: "delay", label: "Delay", hint: "Wait then confirm" },
    { id: "phrase", label: "Phrase", hint: "Type unlock phrase" },
  ];

  const lockUntil =
    force.on && force.reason === "quick_lock" && settings.quick_lock_until
      ? new Date(settings.quick_lock_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-white/80">Quick lock</span>
          {lockUntil && (
            <span className="text-[10px] text-[#e8a598]">Shield forced until {lockUntil}</span>
          )}
          {force.on && force.reason && force.reason !== "quick_lock" && (
            <span className="text-[10px] text-[#e8a598]">On schedule · {force.reason}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[0.5, 1, 2, 4].map((h) => (
            <button
              key={h}
              type="button"
              disabled={disabled}
              onClick={() => quickLock(h)}
              className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:opacity-40"
            >
              {h < 1 ? "30m" : `${h}h`}
            </button>
          ))}
          {force.on && force.reason === "quick_lock" && (
            <button
              type="button"
              onClick={() => patch({ quick_lock_until: null }, "Lock cleared")}
              className="text-xs text-white/65 underline hover:text-white/85"
            >
              Clear lock
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-white/80">Hard unlock</p>
        <p className="mb-2 text-[10px] text-white/50">How hard it is to stop a session or disarm the shield.</p>
        <div className="flex flex-wrap items-center gap-2">
          {hardModes.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              title={m.hint}
              onClick={() => patch({ hard_mode: m.id }, `Hard unlock · ${m.label}`)}
              className={`rounded-md border px-2.5 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:opacity-40 ${
                settings.hard_mode === m.id
                  ? "border-[#b8422e] bg-[#b8422e] text-white"
                  : "border-white/15 text-white/70 hover:bg-white/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-white/80">Schedule</p>
        <p className="mb-2 text-[10px] text-white/50">Auto-arm the shield on these days and hours.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={addWorkdaySchedule}
            className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:opacity-40"
          >
            + Workdays 9–18
          </button>
          {settings.schedules.map((r) => (
            <button
              key={r.id}
              type="button"
              title="Remove schedule"
              aria-label={`Remove schedule ${r.label || ""} ${r.start} to ${r.end}`}
              onClick={() =>
                patch(
                  { schedules: settings.schedules.filter((s) => s.id !== r.id) },
                  "Schedule removed"
                )
              }
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/75 hover:border-white/25 hover:text-white"
            >
              {r.days.map((d) => DAY_LABELS[d]).join("")} {r.start}–{r.end} ✕
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-white/80">Allowlist</p>
        <p className="mb-2 text-[10px] text-white/50">Always reachable even when the shield is on.</p>
        <form onSubmit={addAllow} className="flex gap-2">
          <input
            value={allowDraft}
            onChange={(e) => setAllowDraft(e.target.value)}
            placeholder="example.com"
            aria-label="Allow domain"
            className="input-premium flex-1 bg-white/5 py-1.5 text-sm"
          />
          <button type="submit" className="btn-primary py-1.5! text-xs!" disabled={disabled}>
            Allow
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1">
          {settings.allowlist.length === 0 && (
            <span className="text-[10px] text-white/40">No allowed domains yet</span>
          )}
          {settings.allowlist.map((d) => (
            <button
              key={d}
              type="button"
              aria-label={`Remove ${d} from allowlist`}
              onClick={() =>
                patch({ allowlist: settings.allowlist.filter((x) => x !== d) }, `Removed ${d}`)
              }
              className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60 hover:border-white/25 hover:text-white/85"
            >
              {d} ✕
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onScanHistory} disabled={scanBusy || disabled} className="btn-secondary text-xs">
          {scanBusy ? "Scanning…" : "Scan history"}
        </button>
        <button type="button" onClick={runCoach} disabled={coachBusy || disabled} className="btn-secondary text-xs">
          {coachBusy ? "…" : "AI coach"}
        </button>
        <button type="button" onClick={exportConfig} disabled={disabled} className="btn-secondary text-xs">
          Export
        </button>
        <label className="btn-secondary cursor-pointer text-xs">
          Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            disabled={disabled}
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
              e.target.value = "";
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-white/70">
          Friction
          <input
            type="number"
            min={3}
            max={30}
            value={settings.friction_secs}
            disabled={disabled}
            onChange={(e) => patch({ friction_secs: Number(e.target.value) || 8 })}
            aria-label="Friction seconds"
            className="input-premium w-14 bg-white/5 py-1 text-xs"
          />
          s
        </label>
      </div>

      {suggestions.length > 0 && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {suggestions.slice(0, 8).map((s) => (
            <li key={s.domain} className="truncate text-xs text-white/70">
              {s.domain} · {s.visits}
            </li>
          ))}
        </ul>
      )}

      {devices.length > 0 && (
        <p className="text-[10px] text-white/55">
          Devices: {devices.map((d) => `${d.label || d.kind}${d.shield_on ? " ●" : ""}`).join(" · ")}
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
    // A plain "are you sure?" so a stray click can't end a session. This used
    // to hang off an unlabeled "Anti-Oops" toggle nobody understood.
    return window.confirm(`${actionLabel}?`);
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
