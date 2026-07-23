"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ambientPlayer, AMBIENT_PRESETS, type AmbientId } from "@/lib/ambient";
import { desktopBridge } from "@/lib/desktop";

type Phase = "idle" | "focus" | "break";

type Props = {
  open: boolean;
  phase: Phase;
  remaining: number;
  cycle: number;
  cycles: number;
  onStop: () => void;
  onMinimize?: () => void;
};

const AMBIENT_KEY = "ff-ambient-preset";
const VOL_KEY = "ff-ambient-vol";

function fmt(seconds: number) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Immersive focus stage + bottom-right float timer.
 * Portaled to document.body so parent overflow/transform can't clip it.
 * Qt WebEngine often rejects the Fullscreen API — we never auto-collapse on that.
 */
export function FocusOverlay({ open, phase, remaining, cycle, cycles, onStop, onMinimize }: Props) {
  const [immersive, setImmersive] = useState(true);
  const [ambient, setAmbient] = useState<AmbientId>("off");
  const [volume, setVolume] = useState(0.35);
  const [playerOpen, setPlayerOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const enteredFs = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open && phase !== "idle") {
      setImmersive(true);
      setPlayerOpen(true);
      enteredFs.current = false;
    }
  }, [open, phase !== "idle"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || phase === "idle") {
      desktopBridge.hideFloatTimer();
      return;
    }
    desktopBridge.showFloatTimer({
      remaining,
      phase,
      cycle,
      cycles,
      label: phase === "focus" ? "FOCUS" : "BREAK",
    });
  }, [open, phase, remaining, cycle, cycles]);

  useEffect(() => {
    if (!open || phase === "idle") {
      ambientPlayer.stop();
      return;
    }
    // Timer/overlay open stays silent — ambient only starts when the user picks a preset.
    const vol = Number(localStorage.getItem(VOL_KEY) || "0.35");
    setAmbient("off");
    setVolume(Number.isFinite(vol) ? vol : 0.35);
    ambientPlayer.setVolume(Number.isFinite(vol) ? vol : 0.35);
    return () => {
      ambientPlayer.stop();
    };
  }, [open, phase === "idle"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || phase === "idle" || !immersive) return;
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => {
          enteredFs.current = true;
        })
        .catch(() => {
          enteredFs.current = false;
        });
    }
  }, [open, phase, immersive]);

  useEffect(() => {
    const onFs = () => {
      if (enteredFs.current && !document.fullscreenElement) {
        enteredFs.current = false;
        setImmersive(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (!open || phase === "idle" || !mounted) return null;

  const label = phase === "focus" ? "FOCUS" : "BREAK";
  const sub =
    phase === "focus" ? `Cycle ${cycle}/${cycles} · deep work` : `Cycle ${cycle}/${cycles} · break`;

  async function pickAmbient(id: AmbientId) {
    setAmbient(id);
    localStorage.setItem(AMBIENT_KEY, id);
    await ambientPlayer.set(id);
  }

  function changeVol(v: number) {
    setVolume(v);
    localStorage.setItem(VOL_KEY, String(v));
    ambientPlayer.setVolume(v);
  }

  function minimize() {
    setImmersive(false);
    if (enteredFs.current && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      enteredFs.current = false;
    }
    onMinimize?.();
  }

  function closeAll() {
    ambientPlayer.stop();
    desktopBridge.hideFloatTimer();
    if (enteredFs.current && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      enteredFs.current = false;
    }
    onStop();
  }

  const ui = (
    <>
      {immersive && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Focus session"
        >
          <div className="absolute inset-0 overflow-hidden" aria-hidden>
            <div
              className="focus-kenburns absolute inset-[-8%] bg-cover bg-center"
              style={{ backgroundImage: "url('/fellowship-hero.png')" }}
            />
            <div className="app-scrim absolute inset-0" />
            <div className="focus-fog absolute inset-0" />
          </div>

          <div className="relative z-10 flex items-center justify-between px-5 py-4 md:px-8">
            <p className="font-display text-xs font-semibold tracking-[0.35em] text-white/70">
              THE FELLOWSHIP
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlayerOpen((v) => !v)}
                className="pill-glass rounded-full px-3 py-1.5 text-xs text-white/85 hover:text-white"
              >
                {playerOpen ? "Hide sound" : "Sound · vibrations"}
              </button>
              <button
                type="button"
                onClick={minimize}
                className="pill-glass rounded-full px-3 py-1.5 text-xs text-white/85 hover:text-white"
                title="Keep timer bottom-right"
              >
                Minimize
              </button>
              <button
                type="button"
                onClick={closeAll}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-lg text-white/85 hover:bg-black/70 hover:text-white"
                aria-label="Close session"
                title="End session"
              >
                ×
              </button>
            </div>
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
            <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-white/75">{sub}</p>
            <div className="font-display text-[6.5rem] font-bold leading-none tabular-nums tracking-tight sm:text-[8rem] md:text-[9rem]">
              {fmt(remaining)}
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.45em] text-white/60">{label}</p>

            {playerOpen && (
              <div className="glass-panel mt-8 w-full max-w-md p-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">
                  Ambient / vibrations
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AMBIENT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickAmbient(p.id)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        ambient === p.id
                          ? "border-[#b8422e]/70 bg-[#b8422e]/20 text-white"
                          : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <span className="block text-xs font-semibold">{p.label}</span>
                      <span className="block text-[10px] text-white/70">{p.hint}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-4 flex items-center gap-3 text-xs text-white/60">
                  Volume
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => changeVol(Number(e.target.value))}
                    className="flex-1 accent-[#b8422e]"
                  />
                </label>
                <p className="mt-2 text-[10px] text-white/65">
                  Generated in-app — works offline, no YouTube fight with the shield.
                </p>
              </div>
            )}
          </div>

          <div className="relative z-10 flex justify-center gap-3 pb-8">
            <button type="button" onClick={minimize} className="btn-secondary px-6">
              Work with timer
            </button>
            <button type="button" onClick={closeAll} className="btn-primary px-6">
              End session
            </button>
          </div>
        </div>
      )}

      {!immersive && !desktopBridge.present() && (
        <div className="fixed bottom-5 right-5 z-[9999]">
          <div className="flex items-center gap-2.5 rounded-full border border-white/12 bg-[#1a1c1e]/96 py-1.5 pl-3.5 pr-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              onClick={() => setImmersive(true)}
              className="flex items-center gap-2.5 text-left"
              title="Back to immersive"
            >
              <span
                className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${
                  phase === "break" ? "bg-[#60a5fa]" : "bg-[#b8422e]"
                }`}
              />
              <span className="font-sans text-[15px] font-semibold tabular-nums tracking-wide text-[#f4f4f5]">
                {fmt(remaining)}
              </span>
            </button>
            <button
              type="button"
              onClick={closeAll}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2e3134] text-base leading-none text-white/70 hover:bg-[#3a3d40] hover:text-white"
              aria-label="Close timer"
              title="End session"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(ui, document.body);
}
