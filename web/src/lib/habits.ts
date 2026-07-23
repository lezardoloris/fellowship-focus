/**
 * Habit tracker — inspired by PERSO.xlsx (🗓 Template sheet)
 * Habits × days grid, Goal vs Achieved, verification tiers for stakes.
 */

export type VerificationType = "manual" | "auto_focus" | "auto_clean";

export type HabitPreset = {
  id: string;
  label: string;
  emoji: string;
  verification: VerificationType;
  defaultGoal: number;
  category: "health" | "work" | "focus" | "accountability";
};

/** Heritage SVG mark ids — stored in the habit `emoji` field (legacy unicode still resolves). */
export type HabitMarkId =
  | "sword"
  | "shield"
  | "flame"
  | "candle"
  | "mountain"
  | "tree"
  | "sunrise"
  | "moon"
  | "torii"
  | "lotus"
  | "strength"
  | "run"
  | "book"
  | "quill"
  | "audio"
  | "code"
  | "target"
  | "chart"
  | "crate"
  | "mirror"
  | "gem"
  | "crown"
  | "ring"
  | "spark"
  | "ban"
  | "smoke";

export const HABIT_MARKS: Record<HabitMarkId, { label: string }> = {
  sword: { label: "Quest" },
  shield: { label: "Shield" },
  flame: { label: "Flame" },
  candle: { label: "Candle" },
  mountain: { label: "Mountain" },
  tree: { label: "Forest" },
  sunrise: { label: "Dawn" },
  moon: { label: "Moon" },
  torii: { label: "Torii" },
  lotus: { label: "Stillness" },
  strength: { label: "Strength" },
  run: { label: "Run" },
  book: { label: "Book" },
  quill: { label: "Quill" },
  audio: { label: "Audio" },
  code: { label: "Code" },
  target: { label: "Target" },
  chart: { label: "Growth" },
  crate: { label: "Craft" },
  mirror: { label: "Mirror" },
  gem: { label: "Gem" },
  crown: { label: "Crown" },
  ring: { label: "Ring" },
  spark: { label: "Spark" },
  ban: { label: "Refuse" },
  smoke: { label: "Smoke" },
};

export const DEFAULT_HABIT_MARK: HabitMarkId = "sword";

/** Order shown in the custom-activity picker. */
export const PREMIUM_HABIT_MARKS: HabitMarkId[] = [
  "sword",
  "shield",
  "flame",
  "candle",
  "mountain",
  "tree",
  "sunrise",
  "moon",
  "torii",
  "lotus",
  "strength",
  "run",
  "book",
  "quill",
  "audio",
  "code",
  "target",
  "chart",
  "crate",
  "mirror",
  "gem",
  "crown",
  "ring",
  "spark",
];

/** @deprecated use PREMIUM_HABIT_MARKS — kept so older imports don't break */
export const PREMIUM_HABIT_EMOJIS = PREMIUM_HABIT_MARKS;

const UNICODE_TO_MARK: Record<string, HabitMarkId> = {
  "⚔️": "sword",
  "⚔": "sword",
  "🛡️": "shield",
  "🛡": "shield",
  "🔥": "flame",
  "🕯️": "candle",
  "🕯": "candle",
  "⛰️": "mountain",
  "⛰": "mountain",
  "🌲": "tree",
  "🌅": "sunrise",
  "🌄": "sunrise",
  "🌙": "moon",
  "⛩️": "torii",
  "⛩": "torii",
  "🧘": "lotus",
  "💪": "strength",
  "🏃": "run",
  "📚": "book",
  "✍️": "quill",
  "✍": "quill",
  "🎧": "audio",
  "💻": "code",
  "🎯": "target",
  "📈": "chart",
  "📦": "crate",
  "🪞": "mirror",
  "💎": "gem",
  "👑": "crown",
  "💍": "ring",
  "✨": "spark",
  "🚫": "ban",
  "🚭": "smoke",
};

export function isHabitMarkId(value: string): value is HabitMarkId {
  return Object.prototype.hasOwnProperty.call(HABIT_MARKS, value);
}

/** Resolve stored mark id or legacy unicode emoji → HabitMarkId. */
export function resolveHabitMarkId(raw: string | null | undefined): HabitMarkId {
  const v = (raw || "").trim();
  if (!v) return DEFAULT_HABIT_MARK;
  if (isHabitMarkId(v)) return v;
  return UNICODE_TO_MARK[v] || DEFAULT_HABIT_MARK;
}

/** Presets extracted from PERSO.xlsx + Fellowship auto-tracking */
export const HABIT_PRESETS: HabitPreset[] = [
  { id: "wake-8am", label: "Wake up before 8am", emoji: "sunrise", verification: "manual", defaultGoal: 26, category: "health" },
  { id: "meditate", label: "10 min meditation", emoji: "torii", verification: "manual", defaultGoal: 20, category: "health" },
  { id: "read", label: "Read 1h or 10 pages", emoji: "book", verification: "manual", defaultGoal: 15, category: "health" },
  { id: "podcast", label: "Listen 1 podcast", emoji: "audio", verification: "manual", defaultGoal: 20, category: "work" },
  { id: "sport", label: "Sport", emoji: "strength", verification: "manual", defaultGoal: 20, category: "health" },
  { id: "10-products", label: "10 produits/j", emoji: "crate", verification: "manual", defaultGoal: 15, category: "work" },
  { id: "no-joint", label: "Pas de joint", emoji: "ban", verification: "manual", defaultGoal: 25, category: "accountability" },
  { id: "no-cigarette", label: "Pas de cigarette", emoji: "smoke", verification: "manual", defaultGoal: 25, category: "accountability" },
  { id: "mirror-talk", label: "Parler dans le miroir", emoji: "mirror", verification: "manual", defaultGoal: 20, category: "health" },
  { id: "business-formation", label: "Formation business 4h/sem", emoji: "chart", verification: "manual", defaultGoal: 12, category: "work" },
  { id: "learn-code", label: "Apprendre le code 2h/sem", emoji: "code", verification: "manual", defaultGoal: 8, category: "work" },
  { id: "focus-quest", label: "Focus quest ≥25 min", emoji: "sword", verification: "auto_focus", defaultGoal: 25, category: "focus" },
  { id: "clean-focus", label: "Zero distraction day", emoji: "shield", verification: "auto_clean", defaultGoal: 20, category: "focus" },
];

export const HABIT_XP = {
  PER_CHECKIN: 5,
  MONTHLY_GOAL_BONUS: 30,
  WEEKLY_STREAK_BONUS: 15,
} as const;

export function getMonthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function verificationLabel(v: VerificationType): string {
  switch (v) {
    case "auto_focus":
      return "Auto — focus session";
    case "auto_clean":
      return "Auto — zero blocks";
    default:
      return "Manual — honor system";
  }
}

export function verificationBadge(v: VerificationType): { label: string; color: string } {
  switch (v) {
    case "auto_focus":
      return { label: "✓ Auto", color: "text-green-400" };
    case "auto_clean":
      return { label: "✓ Auto", color: "text-green-400" };
    default:
      return { label: "Manual", color: "text-stone-500" };
  }
}

/** Completion rate 0–100 for stakes settlement */
export function calcCompletionRate(achieved: number, goal: number): number {
  if (goal <= 0) return 100;
  return Math.min(100, Math.round((achieved / goal) * 100));
}

/** Stakes: only auto-verified habits count at 100%; manual at 80% weight unless disputed */
export function calcStakeScore(
  habits: Array<{ verification: VerificationType; achieved: number; goal: number }>
): number {
  if (habits.length === 0) return 0;
  let weighted = 0;
  let weight = 0;
  for (const h of habits) {
    const rate = calcCompletionRate(h.achieved, h.goal);
    const w = h.verification === "manual" ? 0.8 : 1.0;
    weighted += rate * w;
    weight += w;
  }
  return weight > 0 ? Math.round(weighted / weight) : 0;
}
