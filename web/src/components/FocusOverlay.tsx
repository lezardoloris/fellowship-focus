"use client";

import { useEffect, useRef, useState } from "react";
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
 * Fullscreen cinematic focus mode + bottom-right float timer.
 * Video feel via Ken Burns on the fellowship hero; ambient "vibrations"
 * via Web Audio. Desktop gets an always-on-top float timer via the bridge.
 */
export function FocusOverlay({ open, phase, remaining, cycle, cycles, onStop, onMinimize }: Props) {
  const [immersive, setImmersive] = useState(true);
  const [ambient, setAmbient] = useState<AmbientId>("brown");
  const [volume, setVolume] = useState(0.35);
  const [playerOpen, setPlayerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // Sync float timer to desktop (always-on-top OS widget).
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

  // Ambient audio while session is active.
  useEffect(() => {
    if (!open || phase === "idle") {
      ambientPlayer.stop();
      return;
    }
    const saved = (localStorage.getItem(AMBIENT_KEY) as AmbientId) || "brown";
    const vol = Number(localStorage.getItem(VOL_KEY) || "0.35");
    setAmbient(saved);
    setVolume(vol);
    ambientPlayer.setVolume(vol);
    ambientPlayer.set(saved);
    return () => {
      ambientPlayer.stop();
    };
  }, [open, phase === "idle"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enter browser fullscreen once when session starts.
  useEffect(() => {
    if (!open || phase === "idle") {
      startedRef.current = false;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    if (!startedRef.current && immersive) {
      startedRef.current = true;
      const el = rootRef.current;
      if (el && el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    }
  }, [open, phase, immersive]);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (!open || phase === "idle") return null;

  const label = phase === "focus" ? "FOCUS" : "BREAK";
  const sub = phase === "focus" ? `Cycle ${cycle}/${cycles} · deep work` : `Cycle ${cycle}/${cycles} · break`;

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
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onMinimize?.();
  }

  function closeAll() {
    ambientPlayer.stop();
    desktopBridge.hideFloatTimer();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onStop();
  }

  return (
    <>
      {/* Immersive fullscreen stage */}
      {immersive && (
        <div
          ref={rootRef}
          className="fixed inset-0 z-50 flex flex-col bg-black text-white"
          role="dialog"
          aria-label="Focus session"
        >
          <div className="absolute inset-0 overflow-hidden" aria-hidden>
            <div
              className="focus-kenburns absolute inset-[-8%] bg-cover bg-center"
              style={{ backgroundImage: "url('/fellowship-hero.png')" }}
            />
            <div className="absolute inset-0 bg-linear-to-b from-black/35 via-black/25 to-black/70" />
            <div className="focus-fog absolute inset-0" />
          </div>

          <div className="relative z-10 flex items-center justify-between px-6 py-4">
            <p className="font-display text-xs font-semibold tracking-[0.35em] text-white/70">
              THE FELLOWSHIP
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlayerOpen((v) => !v)}
                className="pill-glass rounded-full px-3 py-1.5 text-xs text-white/80 hover:text-white"
              >
                {playerOpen ? "Hide sound" : "Sound · vibrations"}
              </button>
              <button
                type="button"
                onClick={minimize}
                className="pill-glass rounded-full px-3 py-1.5 text-xs text-white/80 hover:text-white"
                title="Keep timer, leave fullscreen"
              >
                Minimize
              </button>
              <button
                type="button"
                onClick={closeAll}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-lg text-white/80 hover:bg-black/60 hover:text-white"
                aria-label="Close session"
                title="End session"
              >
                ×
              </button>
            </div>
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
            <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-white/55">{sub}</p>
            <div className="font-display text-[7rem] font-bold leading-none tabular-nums tracking-tight md:text-[9rem]">
              {fmt(remaining)}
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.45em] text-white/60">{label}</p>

            {playerOpen && (
              <div className="glass-panel mt-10 w-full max-w-md p-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
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
                      <span className="block text-[10px] text-white/45">{p.hint}</span>
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
                <p className="mt-2 text-[10px] text-white/40">
                  Generated in-app — works offline, no YouTube fight with the shield.
                </p>
              </div>
            )}
          </div>

          <div className="relative z-10 flex justify-center pb-8">
            <button type="button" onClick={closeAll} className="btn-secondary px-8">
              End session
            </button>
          </div>
        </div>
      )}

      {/* Bottom-right float timer (browser) — mirrors Cursor-style compact bar */}
      {!immersive && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#1a1c1e]/92 px-1 py-1 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setImmersive(true);
                startedRef.current = false;
              }}
              className="flex items-center gap-3 rounded-md px-3 py-1.5 text-left hover:bg-white/5"
              title="Back to fullscreen"
            >
              <span className="h-2 w-2 rounded-full bg-[#b8422e]" />
              <span className="font-display text-sm font-semibold tabular-nums text-white">
                {fmt(remaining)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
            </button>
            <button
              type="button"
              onClick={closeAll}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white"
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
}
