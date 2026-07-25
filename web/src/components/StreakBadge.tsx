"use client";

export function StreakBadge({
  streak,
  compact = false,
  inDanger = false,
}: {
  streak: number;
  compact?: boolean;
  inDanger?: boolean;
}) {
  // [UX-E5.1] This renders directly on the looping video with no panel behind
  // it — at text-white/40 it measured ~2.6:1, the worst contrast in the app.
  // A compact scrim chip keeps it legible over any frame.
  const chip = compact
    ? ""
    : "rounded-full bg-black/55 px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-[2px]";

  if (streak <= 0 && !inDanger) {
    return compact ? null : (
      <span className={`inline-flex text-sm text-white/75 ${chip}`}>Start a streak today</span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${chip} ${
        compact ? "text-sm" : "text-base"
      } ${inDanger ? "text-amber-300" : "text-white"}`}
      title={inDanger ? "Streak in danger — focus before the day ends" : undefined}
    >
      <span aria-hidden>🔥</span>
      {streak}
      {!compact && <span className="font-normal text-white/85">day streak</span>}
      {inDanger && !compact && (
        <span className="ml-1 text-xs font-normal text-amber-300">at risk</span>
      )}
    </span>
  );
}
