"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FOCUS_MUSIC_KEY, FOCUS_TRACKS, matchLocalTrack } from "@/lib/focusMusic";
import { desktopBridge, isDesktopShell, type MusicState } from "@/lib/desktop";

type ManifestEntry = { title: string; src: string; id?: string; youtubeId?: string };

type FocusMusicPanelProps = {
  /** Horizontal session-row strip (play · title · vol) instead of tall centered panel. */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Compact focus-music picker.
 *
 * Inside the desktop app the real .mp3 files live locally (too large — 1.5 GB —
 * to ship to the web), so the panel drives the native Qt player through the
 * bridge. In a plain browser it plays whatever /audio files happen to be
 * present; when there are none it says so instead of offering a dead Play.
 */
export function FocusMusicPanel({ compact = false, className, style }: FocusMusicPanelProps) {
  const inShell = isDesktopShell();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Desktop (native player) ──
  const [music, setMusic] = useState<MusicState | null>(null);
  const refreshMusic = useCallback(async () => {
    const st = await desktopBridge.musicState();
    if (st) setMusic(st);
  }, []);

  useEffect(() => {
    if (!inShell) return;
    // Older deployed web builds auto-sent play on mount / reload / focus restore.
    // Kill that race once per panel lifetime; Play still works via toggle.
    // musicCmd is isolated from Shield — never call setPrefs / setShield here.
    void desktopBridge.musicCmd({ cmd: "stop" }).then((s) => s && setMusic(s));
    refreshMusic();
    const id = setInterval(refreshMusic, 2000);
    return () => clearInterval(id);
  }, [inShell, refreshMusic]);

  // ── Browser (HTML audio over /audio) ──
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [trackSrc, setTrackSrc] = useState("");
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(0.45);

  useEffect(() => {
    if (inShell) return;
    setTrackSrc(localStorage.getItem(FOCUS_MUSIC_KEY) || "");
    fetch("/audio/manifest.json")
      .then((r) => r.json())
      .then((j) => Array.isArray(j) && setManifest(j as ManifestEntry[]))
      .catch(() => setManifest([]));
  }, [inShell]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol;
  }, [vol]);

  // ── Render: desktop ──
  if (inShell) {
    const available = music?.available && music.tracks.length > 0;
    const title =
      available && music && music.index >= 0
        ? music.tracks[music.index] ?? "Focus music"
        : "Add tracks in the app";
    return (
      <Shell
        compact={compact}
        className={className}
        style={style}
        count={music?.tracks.length ?? 0}
        title={title}
        playing={!!music?.playing}
        disabled={!available}
        onToggle={() =>
          desktopBridge.musicCmd({ cmd: "toggle" }).then((s) => s && setMusic(s))
        }
        volume={music?.volume ?? 0.5}
        onVolume={(v) =>
          desktopBridge.musicCmd({ cmd: "volume", value: v }).then((s) => s && setMusic(s))
        }
        select={
          <select
            value={music?.index ?? -1}
            disabled={!available}
            onChange={(e) =>
              desktopBridge.musicCmd({ cmd: "select", value: Number(e.target.value) }).then(
                (s) => s && setMusic(s)
              )
            }
            className={`input-premium w-full truncate text-sm ${compact ? "py-1.5" : "py-2"}`}
            aria-label="Focus track"
          >
            {!available && <option value={-1}>Add tracks in the app</option>}
            {music?.tracks.map((t, i) => (
              <option key={i} value={i}>
                {t}
              </option>
            ))}
          </select>
        }
      />
    );
  }

  // ── Render: browser ──
  const options = [...manifest]
    .map((m) => {
      const track = matchLocalTrack(m.src) || matchLocalTrack(m.youtubeId || "");
      const rank = track ? FOCUS_TRACKS.findIndex((t) => t.id === track.id) : -1;
      return {
        src: m.src,
        label: track?.title || m.title,
        rank: rank === -1 ? Number.MAX_SAFE_INTEGER : rank,
      };
    })
    .sort((a, b) => a.rank - b.rank);
  const hasLocal = options.length > 0;
  // Prefer saved track; otherwise first in preferred playlist (FOCUS_TRACKS order).
  const current = options.find((o) => o.src === trackSrc) || options[0];

  const play = (src: string) => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (el.src.endsWith(src) && playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    if (!el.src.endsWith(src)) el.src = src;
    el.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  };

  return (
    <Shell
      compact={compact}
      className={className}
      style={style}
      count={options.length}
      title={hasLocal ? current?.label || "Focus music" : "Available in the desktop app"}
      playing={playing}
      disabled={!hasLocal || !current}
      onToggle={() => current && play(current.src)}
      volume={vol}
      onVolume={setVol}
      select={
        <select
          value={current?.src || ""}
          disabled={!hasLocal}
          onChange={(e) => {
            setTrackSrc(e.target.value);
            localStorage.setItem(FOCUS_MUSIC_KEY, e.target.value);
            const el = audioRef.current;
            if (el) {
              el.src = e.target.value;
              if (playing) {
                el.play()
                  .then(() => setPlaying(true))
                  .catch(() => setPlaying(false));
              }
            }
          }}
          className={`input-premium w-full truncate text-sm ${compact ? "py-1.5" : "py-2"}`}
          aria-label="Focus track"
        >
          {!hasLocal && <option value="">No local tracks</option>}
          {options.map((o) => (
            <option key={o.src} value={o.src}>
              {o.label}
            </option>
          ))}
        </select>
      }
    >
      <audio
        ref={audioRef}
        loop
        preload="none"
        className="hidden"
        onEnded={() => setPlaying(false)}
      />
    </Shell>
  );
}

function Shell({
  compact,
  className,
  style,
  count,
  title,
  playing,
  disabled,
  onToggle,
  volume,
  onVolume,
  select,
  children,
}: {
  compact: boolean;
  className?: string;
  style?: CSSProperties;
  count: number;
  title: string;
  playing: boolean;
  disabled: boolean;
  onToggle: () => void;
  volume: number;
  onVolume: (v: number) => void;
  select: ReactNode;
  children?: ReactNode;
}) {
  const rootClass = [
    "glass-panel flex h-full min-h-0 flex-col",
    compact ? "p-3.5" : "p-5",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (compact) {
    return (
      <div className={rootClass} style={style}>
        {children}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            aria-label={playing ? "Pause" : "Play"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_6px_18px_rgba(184,66,46,0.3)] transition disabled:opacity-40 ${
              playing
                ? "bg-[#912a1d] hover:bg-[#b8422e]"
                : "bg-[#b8422e] hover:bg-[#c46551]"
            }`}
          >
            {playing ? (
              <span className="text-xs tracking-widest">❚❚</span>
            ) : (
              <span className="ml-0.5 text-sm">▶</span>
            )}
          </button>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-white/90" title={title}>
                {title}
              </p>
              {count > 0 && (
                <span className="shrink-0 text-xs tabular-nums text-white/40">{count}</span>
              )}
            </div>
            {select}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/45">Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => onVolume(Number(e.target.value))}
                className="h-1 min-w-0 flex-1 accent-[#b8422e]"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass} style={style}>
      {children}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-white/55">Music</p>
        {count > 0 && <span className="text-xs tabular-nums text-white/40">{count}</span>}
      </div>

      <div className="mt-6 flex flex-col items-center text-center">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={playing ? "Pause" : "Play"}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_28px_rgba(184,66,46,0.35)] transition disabled:opacity-40 ${
            playing
              ? "bg-[#912a1d] hover:bg-[#b8422e]"
              : "bg-[#b8422e] hover:bg-[#c46551]"
          }`}
        >
          {playing ? (
            <span className="text-sm tracking-widest">❚❚</span>
          ) : (
            <span className="ml-0.5 text-lg">▶</span>
          )}
        </button>
        <p className="mt-4 line-clamp-2 max-w-[16rem] text-sm font-medium leading-snug text-white/90">
          {title}
        </p>
        {playing && (
          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-[#e07a63]/90">Playing</p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {select}
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-white/45">Vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="h-1 flex-1 accent-[#b8422e]"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
