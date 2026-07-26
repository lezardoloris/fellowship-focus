"use client";

import { useState } from "react";

type Props = {
  token: string;
  kind?: "morning" | "shutdown";
  onDone?: () => void;
};

/**
 * [UX-2] Empty ritual panels used to reserve ~265px for two blank textareas.
 * Idle state is title + one line + a button; the form opens on demand.
 */
export function RitualWizard({ token, kind = "morning", onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [priorities, setPriorities] = useState(["", "", ""]);
  const [focusTarget, setFocusTarget] = useState("180");
  const [wins, setWins] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload =
        kind === "morning"
          ? {
              priorities: priorities.filter(Boolean).slice(0, 3),
              focus_target_min: Number(focusTarget) || 180,
            }
          : { wins: wins.trim(), note: note.trim(), rating: null };
      await fetch("/api/rituals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, kind, payload }),
      });
      setDone(true);
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  if (done && kind === "shutdown") {
    return (
      <div className="premium-panel px-5 py-4 text-center">
        <p className="text-base font-semibold pp-strong">Done for today</p>
        <p className="mt-0.5 text-sm pp-muted">See you tomorrow.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="premium-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="pp-title">{kind === "morning" ? "Morning planning" : "Shutdown"}</p>
          <p className="mt-0.5 text-sm pp-faint">
            {kind === "morning"
              ? "Set three priorities before you start."
              : "Log wins and one note, then close the day."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-[#b8422e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c9563d]"
        >
          {kind === "morning" ? "Plan the day" : "Start shutdown"}
        </button>
      </div>
    );
  }

  return (
    <div className="premium-panel p-5">
      <p className="pp-title">
        {kind === "morning" ? "Morning planning" : "Shutdown"}
      </p>
      {kind === "morning" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm pp-body">Three priorities for today</p>
          {priorities.map((p, i) => (
            <input
              key={i}
              value={p}
              onChange={(e) => {
                const next = [...priorities];
                next[i] = e.target.value;
                setPriorities(next);
              }}
              placeholder={`Priority ${i + 1}`}
              className="pp-input w-full px-3 py-2 text-sm"
            />
          ))}
          <label className="mt-1 block text-xs pp-muted">
            Focus target (minutes)
            <input
              value={focusTarget}
              onChange={(e) => setFocusTarget(e.target.value)}
              className="pp-input mt-1.5 w-full px-3 py-2 text-sm tabular-nums"
            />
          </label>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            placeholder="Wins of the day"
            rows={1}
            className="pp-input w-full px-3 py-2 text-sm"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One note for tomorrow"
            rows={1}
            className="pp-input w-full px-3 py-2 text-sm"
          />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-[#b8422e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c9563d] disabled:opacity-50"
        >
          {kind === "morning" ? "Start the day" : "Finish the day"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm pp-muted transition-colors hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
