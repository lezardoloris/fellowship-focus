/**
 * Transparent Focus Score (0–100) — RescueTime Pulse–style 5-level weighting.
 */

export const SCORE_WEIGHTS = {
  focus: 100,
  work: 75,
  neutral: 50,
  personal: 25,
  distraction: 0,
} as const;

export type ScoreBucket = keyof typeof SCORE_WEIGHTS;

export type ScoreSeconds = {
  focus_seconds?: number;
  work_seconds: number;
  neutral_seconds?: number;
  personal_seconds?: number;
  distraction_seconds: number;
};

/**
 * Weighted average of time spent in each category.
 * Focus minutes (pomodoro) can be passed as focus_seconds for an extra high band.
 */
export function computeFocusScore(s: ScoreSeconds): number {
  const focus = Math.max(0, s.focus_seconds ?? 0);
  const work = Math.max(0, s.work_seconds);
  const neutral = Math.max(0, s.neutral_seconds ?? 0);
  const personal = Math.max(0, s.personal_seconds ?? 0);
  const distraction = Math.max(0, s.distraction_seconds);

  const total = focus + work + neutral + personal + distraction;
  if (total <= 0) return 0;

  const weighted =
    focus * SCORE_WEIGHTS.focus +
    work * SCORE_WEIGHTS.work +
    neutral * SCORE_WEIGHTS.neutral +
    personal * SCORE_WEIGHTS.personal +
    distraction * SCORE_WEIGHTS.distraction;

  return Math.round(weighted / total);
}

/** Legacy 2-bucket formula (desktop usage_tracker) for backward compat. */
export function legacyFocusScore(workSeconds: number, distractionSeconds: number): number {
  const denom = workSeconds + distractionSeconds;
  if (denom <= 0) return 0;
  return Math.round((workSeconds / denom) * 100);
}

export function scoreBreakdown(s: ScoreSeconds): Array<{
  level: ScoreBucket;
  seconds: number;
  weight: number;
  label: string;
}> {
  const rows: Array<{
    level: ScoreBucket;
    seconds: number;
    weight: number;
    label: string;
  }> = [
    { level: "focus", seconds: s.focus_seconds ?? 0, weight: SCORE_WEIGHTS.focus, label: "Focus" },
    { level: "work", seconds: s.work_seconds, weight: SCORE_WEIGHTS.work, label: "Work" },
    { level: "neutral", seconds: s.neutral_seconds ?? 0, weight: SCORE_WEIGHTS.neutral, label: "Neutral" },
    { level: "personal", seconds: s.personal_seconds ?? 0, weight: SCORE_WEIGHTS.personal, label: "Personal" },
    {
      level: "distraction",
      seconds: s.distraction_seconds,
      weight: SCORE_WEIGHTS.distraction,
      label: "Distraction",
    },
  ];
  return rows.filter((b) => b.seconds > 0);
}

export const SCORE_FORMULA_BLURB =
  "Focus Score is a 0–100 pulse: Focus=100, Work=75, Neutral=50, Personal=25, Distraction=0. " +
  "It's the weighted average of time spent in each band today.";
