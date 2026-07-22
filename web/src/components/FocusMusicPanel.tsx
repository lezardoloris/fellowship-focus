"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FOCUS_MUSIC_KEY, FOCUS_TRACKS, matchLocalTrack, type FocusTrack } from "@/lib/focusMusic";

type ManifestEntry = { title: string; src: string; id?: string; youtubeId?: string };

/**
 * Compact focus music picker — plays local /audio files when present
 * (downloaded RF tracks). Works while YouTube is blocked.
 */
export function FocusMusicPanel({ autoPlay = false }: { autoPlay?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [trackId, setTrackId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(0.45);

  useEffect(() => {
    const saved = localStorage.getItem(FOCUS_MUSIC_KEY) || "";
    setTrackId(saved);
    fetch("/audio/manifest.json")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j)) setManifest(j as ManifestEntry[]);
      })
      .catch(() => setManifest([]));
  }, []);

  const options = useMemo(() => {
    // Prefer local manifest entries; use curated catalog titles when we can match.
    if (manifest.length) {
      return manifest.map((m) => {
        const meta =
          matchLocalTrack(m.src) ||
          matchLocalTrack(m.youtubeId || "") ||
          matchLocalTrack(m.title);
        return {
          key: m.src,
          label: meta ? `${meta.title} · ${meta.duration}` : m.title,
          src: m.src,
          meta,
        };
      });
    }
    return FOCUS_TRACKS.map((t) => ({
      key: t.id,
      label: `${t.title} · ${t.duration}`,
      src: "" as string,
      meta: t as FocusTrack,
    }));
  }, [manifest]);

  const current = options.find((o) => o.key === trackId) || options[0];

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = vol;
  }, [vol]);

  useEffect(() => {
    if (!autoPlay || !current?.src) return;
    const el = audioRef.current;
    if (!el) return;
    el.src = current.src;
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [autoPlay, current?.src]);

  function select(key: string) {
    setTrackId(key);
    localStorage.setItem(FOCUS_MUSIC_KEY, key);
    const opt = options.find((o) => o.key === key);
    const el = audioRef.current;
    if (!el || !opt?.src) {
      setPlaying(false);
      return;
    }
    el.src = opt.src;
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  function toggle() {
    const el = audioRef.current;
    if (!el || !current?.src) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      if (!el.src) el.src = current.src;
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  const hasLocal = manifest.length > 0;

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Focus music</p>
        <span className="text-[10px] text-white/35">
          {hasLocal ? `${manifest.length} local` : "Downloading…"}
        </span>
      </div>

      <audio ref={audioRef} loop preload="none" className="hidden" />

      <div className="mt-3 flex gap-2">
        <select
          value={current?.key || ""}
          onChange={(e) => select(e.target.value)}
          className="input-premium flex-1 truncate py-2 text-sm"
          disabled={!hasLocal}
        >
          {!hasLocal && <option value="">Waiting for local tracks…</option>}
          {options.map((o) => (
            <option key={o.key} value={o.key} disabled={!o.src}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggle}
          disabled={!hasLocal || !current?.src}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-white/40">Vol</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={vol}
          onChange={(e) => setVol(Number(e.target.value))}
          className="flex-1"
        />
      </div>

      {!hasLocal && (
        <p className="mt-2 text-[11px] text-white/40">
          Tracks save to <code className="text-white/55">~/.fellowship-focus/music</code> for the
          desktop app. Web picks them up from <code className="text-white/55">/audio</code> when
          synced.
        </p>
      )}
    </div>
  );
}
