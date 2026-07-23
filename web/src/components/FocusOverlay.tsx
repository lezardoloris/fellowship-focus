"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ambientPlayer, AMBIENT_PRESETS, type AmbientId } from "@/lib/ambient";
import { desktopBridge } from "@/lib/desktop";
import { FocusMusicPanel } from "@/components/FocusMusicPanel";

type Phase = "idle" | "focus" | "break";

type Props = {
  open: boolean;
  phase: Phase;
  remaining: number;
  cycle: number;
  cycles: number;
  paused?: boolean;
  awaitingBreak?: boolean;
  onStop: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onMinimize?: () => void;
  onExtend?: (minutes: number) => void;
  onTakeBreak?: () => void;
  onSnooze?: () => void;
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
export function FocusOverlay({
  open,
  phase,
  remaining,
  cycle,
  cycles,
  paused = false,
  awaitingBreak = false,
  onStop,
  onPause,
  onResume,
  onMinimize,
  onExtend,
  onTakeBreak,
  onSnooze,
}: Props) {
  const [immersive, setImmersive] = useState(true);
  const [ambient, setAmbient] = useState<AmbientId>("off");
  const [volume, setVolume] = useState(0.35);
  const [playerOpen, setPlayerOpen] = useState(true);
  const [floatExpanded, setFloatExpanded] = useState(false);
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
    if (awaitingBreak) setFloatExpanded(true);
  }, [awaitingBreak]);

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
      label: awaitingBreak ? "REST?" : paused ? "PAUSED" : phase === "focus" ? "FOCUS" : "BREAK",
      paused: paused || awaitingBreak,
      awaitingBreak,
      expanded: floatExpanded,
    });
  }, [open, phase, remaining, cycle, cycles, paused, awaitingBreak, floatExpanded]);

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

  const label = awaitingBreak ? "REST?" : paused ? "PAUSED" : phase === "focus" ? "FOCUS" : "BREAK";
  const sub = awaitingBreak
    ? `Cycle ${cycle}/${cycles} · the hour ends`
    : paused
      ? `Cycle ${cycle}/${cycles} · paused`
      : phase === "focus"
        ? `Cycle ${cycle}/${cycles} · deep work`
        : `Cycle ${cycle}/${cycles} · break`;

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
            <div
              className={`font-display text-[6.5rem] font-bold leading-none tabular-nums tracking-tight sm:text-[8rem] md:text-[9rem] ${
                paused || awaitingBreak ? "text-white/45" : ""
              }`}
            >
              {fmt(remaining)}
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.45em] text-white/60">{label}</p>

            {awaitingBreak && (
              <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
                <button type="button" className="btn-primary py-2.5" onClick={() => onTakeBreak?.()}>
                  Take break now
                </button>
                <button type="button" className="btn-secondary py-2.5" onClick={() => onSnooze?.()}>
                  Remind in 5 minutes
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn-secondary py-2.5" onClick={() => onExtend?.(5)}>
                    Extend +5
                  </button>
                  <button type="button" className="btn-secondary py-2.5" onClick={() => onExtend?.(10)}>
                    Extend +10
                  </button>
                </div>
              </div>
            )}

            {playerOpen && !awaitingBreak && (
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
            {!awaitingBreak &&
              (paused ? (
                onResume && (
                  <button type="button" onClick={onResume} className="btn-primary px-6">
                    Resume
                  </button>
                )
              ) : (
                onPause &&
                remaining > 0 && (
                  <button type="button" onClick={onPause} className="btn-secondary px-6">
                    Pause
                  </button>
                )
              ))}
            <button type="button" onClick={closeAll} className="btn-primary px-6">
              End session
            </button>
          </div>
        </div>
      )}

      {!immersive && !desktopBridge.present() && (
        <div className="fixed bottom-5 right-5 z-[9999] w-[min(100vw-2.5rem,20rem)]">
          <div
            className={`overflow-hidden border border-white/12 bg-[#1a1c1e]/96 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${
              floatExpanded ? "rounded-2xl" : "rounded-full"
            }`}
          >
            <div className="flex items-center gap-2.5 py-1.5 pl-3.5 pr-1.5">
              <button
                type="button"
                onClick={() => setImmersive(true)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                title="Back to immersive"
              >
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
                  className={`font-sans text-[15px] font-semibold tabular-nums tracking-wide ${
                    paused || awaitingBreak ? "text-white/45" : "text-[#f4f4f5]"
                  }`}
                >
                  {fmt(remaining)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFloatExpanded((v) => !v)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2e3134] text-xs text-white/70 hover:bg-[#3a3d40] hover:text-white"
                aria-label={floatExpanded ? "Collapse" : "Expand"}
              >
                {floatExpanded ? "▴" : "▾"}
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
            {floatExpanded && (
              <div className="space-y-3 border-t border-white/10 px-3.5 pb-3.5 pt-3">
                <FocusMusicPanel compact />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="btn-secondary min-h-8 flex-1 py-1 text-xs"
                    onClick={() => onExtend?.(5)}
                  >
                    +5 min
                  </button>
                  <button
                    type="button"
                    className="btn-secondary min-h-8 flex-1 py-1 text-xs"
                    onClick={() => onExtend?.(10)}
                  >
                    +10 min
                  </button>
                </div>
                {awaitingBreak ? (
                  <div className="flex flex-col gap-1.5">
                    <button type="button" className="btn-primary min-h-8 text-xs" onClick={() => onTakeBreak?.()}>
                      Break now
                    </button>
                    <button type="button" className="btn-secondary min-h-8 text-xs" onClick={() => onSnooze?.()}>
                      Remind in 5 min
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return createPortal(ui, document.body);
}
