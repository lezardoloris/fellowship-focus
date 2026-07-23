"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FOCUS_MUSIC_KEY, FOCUS_TRACKS, matchLocalTrack } from "@/lib/focusMusic";
import { desktopBridge, isDesktopShell, type MusicState } from "@/lib/desktop";

type ManifestEntry = { title: string; src: string; id?: string; youtubeId?: string };

type FocusMusicPanelProps = {
  /** Horizontal session-row strip (play · select · vol) instead of tall centered panel. */
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
          <MusicTrackPicker
            compact={compact}
            disabled={!available}
            value={music?.index ?? -1}
            placeholder="Add tracks in the app"
            ariaLabel="Focus track"
            options={(music?.tracks ?? []).map((t, i) => ({ value: i, label: t }))}
            onChange={(index) => {
              if (typeof index !== "number") return;
              desktopBridge.musicCmd({ cmd: "select", value: index }).then(
                (s) => s && setMusic(s)
              );
            }}
          />
        }
        scrubber={
          available && (music?.durationMs ?? 0) > 0 ? (
            <MusicScrubber
              positionMs={music?.positionMs ?? 0}
              durationMs={music?.durationMs ?? 0}
              playing={!!music?.playing}
              onSeek={(ms) =>
                desktopBridge.musicCmd({ cmd: "seek", value: ms }).then((s) => s && setMusic(s))
              }
            />
          ) : undefined
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
        <MusicTrackPicker
          compact={compact}
          disabled={!hasLocal}
          value={current?.src || ""}
          placeholder="No local tracks"
          ariaLabel="Focus track"
          options={options.map((o) => ({ value: o.src, label: o.label }))}
          onChange={(src) => {
            if (typeof src !== "string") return;
            setTrackSrc(src);
            localStorage.setItem(FOCUS_MUSIC_KEY, src);
            const el = audioRef.current;
            if (el) {
              el.src = src;
              if (playing) {
                el.play()
                  .then(() => setPlaying(true))
                  .catch(() => setPlaying(false));
              }
            }
          }}
        />
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

type TrackOption = { value: string | number; label: string };

function MusicTrackPicker({
  value,
  options,
  disabled = false,
  compact = false,
  placeholder,
  ariaLabel,
  onChange,
}: {
  value: string | number;
  options: TrackOption[];
  disabled?: boolean;
  compact?: boolean;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string | number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass = [
    "music-track-trigger",
    compact ? "music-track-trigger--compact" : "",
    open ? "music-track-trigger--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={triggerClass}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown open={open} />
      </button>
      {open && options.length > 0 ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="music-track-panel music-track-panel-in"
        >
          <ul className="music-track-list music-track-scroll">
            {options.map((o) => {
              const isSelected = o.value === value;
              return (
                <li key={String(o.value)}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`music-track-option${isSelected ? " music-track-option--selected" : ""}`}
                  >
                    <span className="music-track-option-mark" aria-hidden>
                      ●
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-3.5 w-3.5 shrink-0 text-white/45 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seek bar for the current track: advances smoothly while playing, drag to seek. */
function MusicScrubber({
  positionMs,
  durationMs,
  playing,
  onSeek,
}: {
  positionMs: number;
  durationMs: number;
  playing: boolean;
  onSeek: (ms: number) => void;
}) {
  const [pos, setPos] = useState(positionMs);
  const [dragging, setDragging] = useState(false);

  // Adopt the authoritative position from the bridge unless mid-drag.
  useEffect(() => {
    if (!dragging) setPos(positionMs);
  }, [positionMs, dragging]);

  // Tick locally between 2 s bridge syncs so the bar doesn't stutter.
  useEffect(() => {
    if (!playing || dragging) return;
    const id = setInterval(() => setPos((p) => Math.min(durationMs, p + 500)), 500);
    return () => clearInterval(id);
  }, [playing, dragging, durationMs]);

  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-white/45">{fmt(pos)}</span>
      <input
        type="range"
        min={0}
        max={durationMs}
        step={1000}
        value={pos}
        onChange={(e) => {
          setDragging(true);
          setPos(Number(e.target.value));
        }}
        onMouseUp={(e) => {
          onSeek(Number((e.target as HTMLInputElement).value));
          setDragging(false);
        }}
        onTouchEnd={(e) => {
          onSeek(Number((e.target as HTMLInputElement).value));
          setDragging(false);
        }}
        className="h-1 min-w-0 flex-1 accent-[#b8422e]"
        aria-label="Seek"
      />
      <span className="w-9 shrink-0 text-[10px] tabular-nums text-white/45">{fmt(durationMs)}</span>
    </div>
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
  scrubber,
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
  scrubber?: ReactNode;
  children?: ReactNode;
}) {
  const rootClass = [
    "glass-panel flex w-full min-w-0 flex-col",
    /* Compact: hug content height — never stretch into empty vertical space. */
    compact ? "h-auto p-3" : "h-full min-h-0 p-5",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (compact) {
    return (
      <div className={rootClass} style={style}>
        {children}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            aria-label={playing ? "Pause" : "Play"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-[0_6px_18px_rgba(184,66,46,0.3)] transition disabled:opacity-40 ${
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
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">{select}</div>
              {count > 0 && (
                <span className="shrink-0 text-xs tabular-nums text-white/40">{count}</span>
              )}
            </div>
            {scrubber}
            <div className="flex items-center gap-1.5">
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
        <p className="mt-4 w-full line-clamp-2 text-sm font-medium leading-snug text-white/90">
          {title}
        </p>
        {playing && (
          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-[#e07a63]/90">Playing</p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {select}
        {scrubber}
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
