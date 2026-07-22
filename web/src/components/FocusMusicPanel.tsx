"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FOCUS_MUSIC_KEY, matchLocalTrack } from "@/lib/focusMusic";
import { desktopBridge, isDesktopShell, type MusicState } from "@/lib/desktop";

type ManifestEntry = { title: string; src: string; id?: string; youtubeId?: string };

/**
 * Compact focus-music picker.
 *
 * Inside the desktop app the real .mp3 files live locally (too large — 1.5 GB —
 * to ship to the web), so the panel drives the native Qt player through the
 * bridge. In a plain browser it plays whatever /audio files happen to be
 * present; when there are none it says so instead of offering a dead Play.
 */
export function FocusMusicPanel({ autoPlay = false }: { autoPlay?: boolean }) {
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
    refreshMusic();
    const id = setInterval(refreshMusic, 2000);
    return () => clearInterval(id);
  }, [inShell, refreshMusic]);

  // Auto-play ONCE when a focus phase begins — on the rising edge of autoPlay,
  // never on every state change. The old effect depended on `music`, so pausing
  // (or the 2 s poll) re-ran it and instantly restarted playback: pause could
  // never stick during a session.
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (!inShell) return;
    if (!autoPlay) {
      autoPlayedRef.current = false;
      return;
    }
    if (autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    desktopBridge.musicCmd({ cmd: "play" }).then((s) => s && setMusic(s));
  }, [inShell, autoPlay]);

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
    const label =
      music && music.index >= 0 ? music.tracks[music.index] : "No tracks";
    return (
      <Shell count={music?.tracks.length ?? 0}>
        <div className="flex items-center gap-2">
          <select
            value={music?.index ?? -1}
            disabled={!available}
            onChange={(e) =>
              desktopBridge.musicCmd({ cmd: "select", value: Number(e.target.value) }).then(
                (s) => s && setMusic(s)
              )
            }
            className="input-premium min-w-0 flex-1 truncate py-1.5 text-sm"
          >
            {!available && <option value={-1}>Add tracks in the app</option>}
            {music?.tracks.map((t, i) => (
              <option key={i} value={i}>
                {t}
              </option>
            ))}
          </select>
          <TransportButton
            playing={!!music?.playing}
            disabled={!available}
            onClick={() =>
              desktopBridge.musicCmd({ cmd: "toggle" }).then((s) => s && setMusic(s))
            }
          />
        </div>
        {available && (
          <p className="mt-1.5 truncate text-[11px] text-white/60">{label}</p>
        )}
        <Volume
          value={music?.volume ?? 0.5}
          onChange={(v) => desktopBridge.musicCmd({ cmd: "volume", value: v }).then((s) => s && setMusic(s))}
        />
      </Shell>
    );
  }

  // ── Render: browser ──
  const options = manifest.map((m) => ({
    src: m.src,
    label: matchLocalTrack(m.src)?.title || matchLocalTrack(m.youtubeId || "")?.title || m.title,
  }));
  const hasLocal = options.length > 0;
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
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <Shell count={options.length}>
      <audio ref={audioRef} loop preload="none" className="hidden" onEnded={() => setPlaying(false)} />
      <div className="flex items-center gap-2">
        <select
          value={current?.src || ""}
          disabled={!hasLocal}
          onChange={(e) => {
            setTrackSrc(e.target.value);
            localStorage.setItem(FOCUS_MUSIC_KEY, e.target.value);
            play(e.target.value);
          }}
          className="input-premium min-w-0 flex-1 truncate py-1.5 text-sm"
        >
          {!hasLocal && <option value="">No local tracks</option>}
          {options.map((o) => (
            <option key={o.src} value={o.src}>
              {o.label}
            </option>
          ))}
        </select>
        <TransportButton
          playing={playing}
          disabled={!hasLocal || !current}
          onClick={() => current && play(current.src)}
        />
      </div>
      {!hasLocal && (
        <p className="mt-1.5 text-[11px] text-white/60">
          Music plays in the desktop app. Get it from the shield bar.
        </p>
      )}
      <Volume value={vol} onChange={setVol} />
    </Shell>
  );
}

function Shell({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Focus music</p>
        {count > 0 && <span className="text-[10px] text-white/45">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function TransportButton({
  playing,
  disabled,
  onClick,
}: {
  playing: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={playing ? "Pause" : "Play"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b8422e] text-white transition hover:bg-[#c46551] disabled:opacity-40"
    >
      {playing ? (
        <span className="text-xs">❚❚</span>
      ) : (
        <span className="ml-0.5 text-sm">▶</span>
      )}
    </button>
  );
}

function Volume({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[10px] text-white/55">Vol</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-[#b8422e]"
      />
    </div>
  );
}
