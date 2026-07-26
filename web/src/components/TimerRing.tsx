"use client";

import type { ReactNode } from "react";

/**
 * The focus timer as a progress ring — the hero of the Focus tab.
 *
 * Ships the Pencil mockup: a soft accent glow behind a thin track, the arc
 * draining as the session runs, and the digits sitting inside it. The ring
 * makes remaining time readable at a glance from across the room, which a
 * bare number never did.
 *
 * `progress` is 0..1 remaining. Break phases use a cooler tone so the two
 * states are never confused.
 */
export function TimerRing({
  progress,
  size = 260,
  tone = "focus",
  dim = false,
  children,
}: {
  progress: number;
  size?: number;
  tone?: "focus" | "break";
  /** Paused / idle — mutes the glow so it stops pulling the eye. */
  dim?: boolean;
  children: ReactNode;
}) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const stroke = Math.round(size * 0.035);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone === "break" ? "var(--color-info, #5b9bd5)" : "var(--accent)";

  return (
    <div
      className="relative mx-auto grid place-items-center"
      style={{ width: size, height: size }}
    >
      {/* Ambient glow — decorative only, never a layout participant. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 62%)`,
          opacity: dim ? 0.05 : 0.16,
          filter: "blur(26px)",
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{
            transition: "stroke-dashoffset 0.6s linear, stroke 0.4s ease",
            opacity: dim ? 0.45 : 1,
          }}
        />
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  );
}
