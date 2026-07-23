"use client";

import { useEffect, useState } from "react";

const KEY = "ff-onboarded";

type Step = { id: string; label: string; done: boolean };

export function OnboardingCard({
  connected,
  hasSites,
  shieldOn,
  startedOnce,
}: {
  connected: boolean;
  hasSites: boolean;
  shieldOn: boolean;
  startedOnce: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Two stores so a dismiss sticks even if one is wiped (the desktop webview
    // can be off-the-record for localStorage): localStorage + a long cookie.
    try {
      const ls = localStorage.getItem(KEY) === "1";
      const ck = document.cookie.includes(`${KEY}=1`);
      setDismissed(ls || ck);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const steps: Step[] = [
    { id: "connect", label: "Connect Shield (app or extension)", done: connected },
    { id: "preset", label: "Add a block preset or site", done: hasSites },
    { id: "shield", label: "Turn Shield ON", done: shieldOn },
    { id: "start", label: "Start a focus session", done: startedOnce },
  ];
  const allDone = steps.every((s) => s.done);

  function finish() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    try {
      // ~5 year cookie — survives even if localStorage is cleared.
      document.cookie = `${KEY}=1; max-age=157680000; path=/`;
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="glass-panel mb-4 border border-[#b8422e]/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c46551]">First run</p>
          <h2 className="font-display mt-1 text-lg text-white">Activate your Shield</h2>
          <p className="mt-1 text-sm text-white/65">
            Connect → pick sites → Shield ON → Start. That is the product.
          </p>
        </div>
        <button type="button" onClick={finish} className="text-xs text-white/45 hover:text-white/80">
          {allDone ? "Done" : "Skip"}
        </button>
      </div>
      <ol className="mt-3 space-y-1.5 text-sm">
        {steps.map((s, i) => (
          <li key={s.id} className={`flex items-center gap-2 ${s.done ? "text-emerald-400/90" : "text-white/70"}`}>
            <span className="tabular-nums text-white/40">{i + 1}.</span>
            <span>{s.done ? "✓ " : ""}{s.label}</span>
          </li>
        ))}
      </ol>
      {allDone && (
        <button type="button" onClick={finish} className="btn-primary mt-3">
          Mark onboarded
        </button>
      )}
    </div>
  );
}
