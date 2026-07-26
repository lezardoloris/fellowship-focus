"use client";

export type SessionRecapData = {
  session_id?: string;
  minutes: number;
  planned_minutes?: number | null;
  focus_score?: number;
  blocks_during_session?: number;
  xp_earned?: number;
  streak?: number;
  value_line?: string;
  focusing_now?: number;
  clean_session?: boolean;
};

type Props = {
  recap: SessionRecapData;
  onClose: () => void;
  onBreak?: () => void;
  onExtend?: () => void;
  onAgain?: () => void;
  onGoalDone?: (yes: boolean) => void;
};

export function SessionRecapCard({
  recap,
  onClose,
  onBreak,
  onExtend,
  onAgain,
  onGoalDone,
}: Props) {
  const planned = recap.planned_minutes;
  const minsLabel =
    planned && planned > 0
      ? `${recap.minutes} / ${planned} min`
      : `${recap.minutes} min`;

  return (
    // [HUD-H5] Same geometry as the desktop recap card (clipped corners,
    // corner ticks), so the two read as the same product.
    <div
      className="hud-panel fixed bottom-4 right-4 z-[80] w-[min(360px,calc(100vw-2rem))] p-4"
      data-augmented-ui="tl-clip br-clip both"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#c4653a]">Session complete</p>
          <h3 className="mt-1 text-lg font-semibold pp-strong">{minsLabel}</h3>
          <p className="mt-1 text-sm pp-muted">
            {recap.value_line || "Nice work."}
            {recap.streak != null ? ` · 🔥 ${recap.streak}` : ""}
            {recap.xp_earned ? ` · +${recap.xp_earned} XP` : ""}
          </p>
          {recap.focus_score != null && recap.focus_score > 0 && (
            <p className="mt-1 text-xs pp-faint">Focus score {recap.focus_score}</p>
          )}
          {recap.focusing_now != null && recap.focusing_now > 0 && (
            <p className="mt-1 text-xs pp-faint">
              {recap.focusing_now} focusing with you
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="pp-faint hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {onGoalDone && (
        <div className="mt-3 flex items-center gap-2 text-xs pp-muted">
          <span>Finished what you wanted?</span>
          <button
            type="button"
            className="rounded-md border border-white/15 px-2 py-1 hover:bg-white/10"
            onClick={() => onGoalDone(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className="rounded-md border border-white/15 px-2 py-1 hover:bg-white/10"
            onClick={() => onGoalDone(false)}
          >
            Not yet
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {onBreak && (
          <button
            type="button"
            onClick={onBreak}
            className="rounded-lg bg-[#b8422e] px-3 py-1.5 text-sm font-semibold pp-strong"
          >
            Break
          </button>
        )}
        {onExtend && (
          <button
            type="button"
            onClick={onExtend}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm pp-strong hover:bg-white/10"
          >
            +10
          </button>
        )}
        {onAgain && (
          <button
            type="button"
            onClick={onAgain}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm pp-strong hover:bg-white/10"
          >
            Again
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm pp-muted hover:bg-white/5"
        >
          Close
        </button>
      </div>
    </div>
  );
}
