/**
 * Solo habit tracker — localStorage, no guild required.
 * Same grid shape as the server HabitTracker so the UI can share one component.
 */

import {
  HABIT_PRESETS,
  calcCompletionRate,
  getMonthDays,
  type HabitPreset,
  type VerificationType,
} from "@/lib/habits";

const STORE_KEY = "ff-solo-habits-v1";
const SESSIONS_KEY = "ff-solo-sessions";

export type SoloHabit = {
  id: string;
  presetId?: string;
  label: string;
  emoji: string;
  verification: VerificationType;
  goal: number;
  /** date (YYYY-MM-DD) → completed */
  checkins: Record<string, boolean>;
};

type Store = {
  habits: SoloHabit[];
};

/** Default rows matching the product screenshot */
const DEFAULT_PRESET_IDS = ["meditate", "sport", "focus-quest", "clean-focus"] as const;

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadStore(): Store {
  if (typeof window === "undefined") return { habits: [] };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const seeded = seedDefaults();
      saveStore(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Store;
    if (!Array.isArray(parsed.habits)) return seedDefaults();
    return parsed;
  } catch {
    return seedDefaults();
  }
}

function saveStore(store: Store): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function seedDefaults(): Store {
  const habits: SoloHabit[] = DEFAULT_PRESET_IDS.map((id) => {
    const p = HABIT_PRESETS.find((x) => x.id === id)!;
    return {
      id: uid(id),
      presetId: p.id,
      label: p.label,
      emoji: p.emoji,
      verification: p.verification,
      goal: p.defaultGoal,
      checkins: {},
    };
  });
  return { habits };
}

function focusMinutesByDay(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const list = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]") as Array<{
      date: string;
      minutes: number;
    }>;
    const map: Record<string, number> = {};
    for (const s of list) {
      map[s.date] = (map[s.date] || 0) + (s.minutes || 0);
    }
    return map;
  } catch {
    return {};
  }
}

/** Apply auto checkins from local focus sessions (≥25 min = focus quest). */
function withAutoCheckins(habit: SoloHabit, year: number, month: number): SoloHabit {
  if (habit.verification !== "auto_focus") return habit;
  const mins = focusMinutesByDay();
  const days = getMonthDays(year, month);
  const checkins = { ...habit.checkins };
  for (let i = 1; i <= days; i++) {
    const d = `${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    if ((mins[d] || 0) >= 25) checkins[d] = true;
  }
  return { ...habit, checkins };
}

export type SoloHabitRow = {
  id: string;
  label: string;
  emoji: string;
  verification: string;
  goal: number;
  achieved: number;
  completionRate: number;
  checkins: Record<string, { completed: boolean; verified_by: string }>;
};

export function getSoloHabitGrid(year: number, month: number): SoloHabitRow[] {
  const store = loadStore();
  const days = getMonthDays(year, month);
  return store.habits.map((raw) => {
    const habit = withAutoCheckins(raw, year, month);
    const checkins: SoloHabitRow["checkins"] = {};
    let achieved = 0;
    for (let i = 1; i <= days; i++) {
      const d = `${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      if (habit.checkins[d]) {
        checkins[d] = {
          completed: true,
          verified_by: habit.verification === "manual" ? "manual" : habit.verification,
        };
        achieved += 1;
      }
    }
    return {
      id: habit.id,
      label: habit.label,
      emoji: habit.emoji,
      verification: habit.verification,
      goal: habit.goal,
      achieved,
      completionRate: calcCompletionRate(achieved, habit.goal),
      checkins,
    };
  });
}

export function listSoloHabits(): SoloHabit[] {
  return loadStore().habits;
}

export function addSoloPreset(presetId: string): SoloHabit | null {
  const preset = HABIT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const store = loadStore();
  if (store.habits.some((h) => h.presetId === presetId || h.label === preset.label)) {
    return null;
  }
  const habit: SoloHabit = {
    id: uid(presetId),
    presetId: preset.id,
    label: preset.label,
    emoji: preset.emoji,
    verification: preset.verification,
    goal: preset.defaultGoal,
    checkins: {},
  };
  store.habits.push(habit);
  saveStore(store);
  return habit;
}

export function addSoloCustom(input: {
  label: string;
  emoji?: string;
  goal?: number;
}): SoloHabit | null {
  const label = input.label.trim();
  if (!label) return null;
  const store = loadStore();
  if (store.habits.some((h) => h.label.toLowerCase() === label.toLowerCase())) {
    return null;
  }
  const habit: SoloHabit = {
    id: uid("custom"),
    label,
    emoji: (input.emoji || "✨").trim() || "✨",
    verification: "manual",
    goal: Math.max(1, Math.min(31, input.goal ?? 20)),
    checkins: {},
  };
  store.habits.push(habit);
  saveStore(store);
  return habit;
}

export function toggleSoloCheckin(habitId: string, date: string): boolean {
  const store = loadStore();
  const habit = store.habits.find((h) => h.id === habitId);
  if (!habit || habit.verification !== "manual") return false;
  if (habit.checkins[date]) {
    delete habit.checkins[date];
  } else {
    habit.checkins[date] = true;
  }
  saveStore(store);
  return true;
}

export function removeSoloHabit(habitId: string): void {
  const store = loadStore();
  store.habits = store.habits.filter((h) => h.id !== habitId);
  saveStore(store);
}

export function soloPresetIdsInUse(): Set<string> {
  return new Set(
    loadStore()
      .habits.map((h) => h.presetId)
      .filter(Boolean) as string[]
  );
}

export { HABIT_PRESETS };
export type { HabitPreset };
