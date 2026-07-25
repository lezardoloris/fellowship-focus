"use client";

import { useState } from "react";

type Props = {
  token: string;
  kind?: "morning" | "shutdown";
  onDone?: () => void;
};

export function RitualWizard({ token, kind = "morning", onDone }: Props) {
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
      <div className="premium-panel p-6 text-center">
        <p className="text-lg font-semibold pp-strong">Done for today</p>
        <p className="mt-1 text-sm pp-muted">See you tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="premium-panel p-5">
      <p className="pp-title">
        {kind === "morning" ? "Morning planning" : "Shutdown"}
      </p>
      {kind === "morning" ? (
        <div className="mt-3.5 space-y-2.5">
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
          <label className="mt-2 block text-xs pp-muted">
            Focus target (minutes)
            <input
              value={focusTarget}
              onChange={(e) => setFocusTarget(e.target.value)}
              className="pp-input mt-1.5 w-full px-3 py-2 text-sm tabular-nums"
            />
          </label>
        </div>
      ) : (
        <div className="mt-3.5 space-y-2.5">
          <textarea
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            placeholder="Wins of the day"
            rows={2}
            className="pp-input w-full px-3 py-2 text-sm"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One note for tomorrow"
            rows={2}
            className="pp-input w-full px-3 py-2 text-sm"
          />
        </div>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="mt-4 rounded-lg bg-[#b8422e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c9563d] disabled:opacity-50"
      >
        {kind === "morning" ? "Start the day" : "Finish the day"}
      </button>
    </div>
  );
}
