"use client";

/**
 * Reserved-height loading placeholders. [UX-E3.1]
 *
 * Seven panels used to `return null` while fetching, then insert themselves
 * into the layout — shoving everything below them down on every page load.
 * A skeleton of the SAME height keeps the layout still, so nothing jumps
 * under the cursor.
 */

export function SkeletonLine({
  w = "100%",
  h = 12,
  className = "",
}: {
  w?: string | number;
  h?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: `${h}px` }}
    />
  );
}

/** A premium panel-shaped skeleton. `lines` shapes the body. */
export function SkeletonPanel({
  title = true,
  lines = 3,
  minHeight,
  children,
}: {
  title?: boolean;
  lines?: number;
  minHeight?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="premium-panel p-5"
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
      aria-busy="true"
      aria-live="polite"
    >
      {title && <SkeletonLine w={110} h={10} />}
      {children ?? (
        <div className="mt-4 flex flex-col gap-2.5">
          {Array.from({ length: lines }).map((_, i) => (
            <SkeletonLine key={i} w={i === lines - 1 ? "60%" : "100%"} h={12} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Big-number tiles row (Focus score, Money). */
export function SkeletonTiles({ count = 4, minHeight }: { count?: number; minHeight?: number }) {
  return (
    <div className="premium-panel p-5" style={minHeight ? { minHeight: `${minHeight}px` } : undefined} aria-busy="true">
      <SkeletonLine w={110} h={10} />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <SkeletonLine w={72} h={26} />
            <SkeletonLine w={54} h={10} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <SkeletonLine w="100%" h={12} />
        <SkeletonLine w="85%" h={12} />
        <SkeletonLine w="70%" h={12} />
      </div>
    </div>
  );
}
