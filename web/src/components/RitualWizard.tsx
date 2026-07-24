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
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="text-lg font-semibold text-white">Done for today</p>
        <p className="mt-1 text-sm text-white/50">See you tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#c4653a]">
        {kind === "morning" ? "Morning planning" : "Shutdown"}
      </p>
      {kind === "morning" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-white/55">Three priorities for today</p>
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
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          ))}
          <label className="mt-2 block text-xs text-white/40">
            Focus target (minutes)
            <input
              value={focusTarget}
              onChange={(e) => setFocusTarget(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </label>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            placeholder="Wins of the day"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One note for tomorrow"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          />
        </div>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="mt-3 rounded-lg bg-[#b8422e] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {kind === "morning" ? "Start the day" : "Finish the day"}
      </button>
    </div>
  );
}
