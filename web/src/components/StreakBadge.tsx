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
  if (streak <= 0 && !inDanger) {
    return compact ? null : (
      <span className="text-sm text-white/40">Start a streak today</span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${
        compact ? "text-sm" : "text-base"
      } ${inDanger ? "text-amber-400" : "text-white"}`}
      title={inDanger ? "Streak in danger — focus before the day ends" : undefined}
    >
      <span aria-hidden>🔥</span>
      {streak}
      {!compact && <span className="font-normal text-white/45">day streak</span>}
      {inDanger && !compact && (
        <span className="ml-1 text-xs font-normal text-amber-400/90">at risk</span>
      )}
    </span>
  );
}
