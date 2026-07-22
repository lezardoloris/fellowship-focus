"use client";

/** Centered premium loader — ring + shield mark, no “Loading…” copy. */
export function PremiumLoader({
  className = "",
  size = "md",
  full = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Fill available area and center (default for page/tab loads). */
  full?: boolean;
}) {
  const dim = size === "sm" ? 36 : size === "lg" ? 72 : 52;
  const wrap = full
    ? "flex min-h-[40vh] w-full items-center justify-center"
    : "inline-flex items-center justify-center";

  return (
    <div className={`${wrap} ${className}`} role="status" aria-label="Loading">
      <div className="premium-loader relative" style={{ width: dim, height: dim }}>
        <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
          {/* Outer orbit */}
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
          />
          <circle
            className="premium-loader-ring"
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="#b8422e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="44 132"
          />
          {/* Shield */}
          <path
            className="premium-loader-mark"
            d="M32 14c6 3.5 12 4.5 16 5v12.5c0 9.5-6.2 16.8-16 20.5-9.8-3.7-16-11-16-20.5V19c4-.5 10-1.5 16-5Z"
            fill="rgba(184,66,46,0.18)"
            stroke="#e8a090"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M32 22v18M26 31h12"
            stroke="#f4f4f5"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>
      </div>
    </div>
  );
}
