"use client";

import { useEffect, useState } from "react";
import type { BackgroundQuality } from "@/lib/backgroundPrefs";
import { scenePoster, type SceneId } from "@/lib/scenes";

/**
 * Full-bleed still backdrop behind the app.
 *
 * [PRF-2] This used to be an HD looping video. Measured cost inside the desktop
 * shell: 1916 seconds of CPU over 62 minutes of wall time, roughly half a core,
 * sustained, for a background nobody looks at while they work. Pausing it when
 * the window lost focus took that to under 5%, which proved where the cost was
 * but still left a decoder running whenever the app was in front.
 *
 * So the video is gone rather than merely throttled. A focus tool that heats
 * the machine it is supposed to make you productive on has its priorities
 * backwards, and the poster frame was carrying the whole look anyway.
 *
 * `quality` is kept in the signature: callers and the settings panel still pass
 * it, and it is the hook a future opt-in would use. It no longer selects a
 * codec path because there is none.
 */
export function ImmersiveScene({
  scene,
  quality: _quality = "balanced",
  className = "",
}: {
  scene: SceneId;
  quality?: BackgroundQuality;
  className?: string;
}) {
  const [current, setCurrent] = useState(scene);
  const [prev, setPrev] = useState<SceneId | null>(null);
  const [fading, setFading] = useState(false);

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
    // Warm the next poster so a scene change does not flash the ground colour.
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
        />
      )}
      <SceneLayer key={current} scene={current} className="opacity-100" />
      <div className="immersive-scrim absolute inset-0" />
    </div>
  );
}

function SceneLayer({ scene, className }: { scene: SceneId; className?: string }) {
  return (
    <div
      className={`absolute inset-0 bg-cover bg-center ${className || ""}`}
      style={{ backgroundImage: `url('${scenePoster(scene)}')` }}
    />
  );
}
