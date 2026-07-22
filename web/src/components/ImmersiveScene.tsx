"use client";

import { useEffect, useState } from "react";
import { sceneSrc, type SceneId } from "@/lib/scenes";

/**
 * Fixed, edge-to-edge HD scene behind the whole app.
 * Crossfades when `scene` changes; kenburns for presence.
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

  useEffect(() => {
    if (scene === current) return;
    setPrev(current);
    setCurrent(scene);
    setFading(true);
    const t = setTimeout(() => {
      setPrev(null);
      setFading(false);
    }, 900);
    return () => clearTimeout(t);
  }, [scene, current]);

  // Preload on mount
  useEffect(() => {
    const img = new Image();
    img.src = sceneSrc(scene);
  }, [scene]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {prev && (
        <div
          className={`immersive-layer absolute inset-0 bg-cover bg-center transition-opacity duration-[900ms] ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          style={{ backgroundImage: `url('${sceneSrc(prev)}')` }}
        />
      )}
      <div
        key={current}
        className="immersive-kenburns absolute inset-[-8%] bg-cover bg-center"
        style={{ backgroundImage: `url('${sceneSrc(current)}')` }}
      />
      {/* Feather only — keep HD scene vivid */}
      <div className="immersive-scrim absolute inset-0" />
    </div>
  );
}
