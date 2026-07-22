"use client";

import { useEffect, useRef, useState } from "react";
import { scenePoster, sceneVideo, type SceneId } from "@/lib/scenes";

/**
 * Full-bleed HD looping video behind the app.
 * Perf: poster-first, one playing video, pause when hidden,
 * no backdrop-blur dependency, skip motion when reduced-motion.
 */
export function ImmersiveScene({
  scene,
  className = "",
}: {
  scene: SceneId;
  className?: string;
}) {
  const [current, setCurrent] = useState(scene);
  const [prev, setPrev] = useState<SceneId | null>(null);
  const [fading, setFading] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (scene === current) return;
    setPrev(current);
    setCurrent(scene);
    setFading(true);
    const t = window.setTimeout(() => {
      setPrev(null);
      setFading(false);
    }, 600);
    return () => window.clearTimeout(t);
  }, [scene, current]);

  useEffect(() => {
    const img = new Image();
    img.src = scenePoster(scene);
  }, [scene]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0a0c0e] ${className}`}
      aria-hidden
    >
      {prev && (
        <SceneLayer
          scene={prev}
          className={`transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}
          play={false}
          reduceMotion={reduceMotion}
        />
      )}
      <SceneLayer
        key={current}
        scene={current}
        className="opacity-100"
        play={visible && !reduceMotion}
        reduceMotion={reduceMotion}
      />
      <div className="immersive-scrim absolute inset-0" />
    </div>
  );
}

function SceneLayer({
  scene,
  className,
  play,
  reduceMotion,
}: {
  scene: SceneId;
  className?: string;
  play: boolean;
  reduceMotion: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const poster = scenePoster(scene);
  const video = sceneVideo(scene);
  const useVideo = Boolean(video) && !reduceMotion;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !useVideo) return;
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;

    // The ping-pong is baked into the file itself (scripts/make-pingpong.mjs),
    // so plain native looping gives a seamless forward/backward cycle. Driving
    // the reverse leg from JS forced a seek per frame and stuttered.
    if (play) {
      const p = el.play();
      if (p) p.catch(() => {});
    } else {
      el.pause();
    }
  }, [play, useVideo, scene]);

  return (
    <div className={`absolute inset-0 ${className || ""}`}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${poster}')` }}
      />
      {useVideo && video && (
        <video
          ref={videoRef}
          className={`immersive-video absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
          src={video}
          poster={poster}
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onLoadedData={() => setReady(true)}
          onCanPlay={() => setReady(true)}
        />
      )}
    </div>
  );
}
