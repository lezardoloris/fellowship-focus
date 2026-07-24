/**
 * Work-day-aware streak helpers.
 * Off days (weekends by default) never break the chain.
 */

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5] as const; // Mon–Fri (JS: Sun=0)

export type WorkDayMask = number[]; // 0=Sun … 6=Sat

export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export function addDays(iso: string, delta: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + delta);
  return isoDate(d);
}

export function isWorkDay(iso: string, workDays: WorkDayMask = [...DEFAULT_WORK_DAYS]): boolean {
  const dow = parseIso(iso).getDay();
  return workDays.includes(dow);
}

/** Previous calendar day that counts for streak (skips off days). */
export function prevWorkDay(iso: string, workDays: WorkDayMask = [...DEFAULT_WORK_DAYS]): string {
  let cursor = addDays(iso, -1);
  for (let i = 0; i < 14; i++) {
    if (isWorkDay(cursor, workDays)) return cursor;
    cursor = addDays(cursor, -1);
  }
  return addDays(iso, -1);
}

/**
 * Advance streak given last quest date and today's completion.
 * Off days between last_quest and today do not reset.
 */
export function computeStreakAdvance(opts: {
  currentStreak: number;
  lastQuestDate: string | null;
  today: string;
  qualifying: boolean;
  workDays?: WorkDayMask;
}): number {
  const workDays = opts.workDays ?? [...DEFAULT_WORK_DAYS];
  if (!opts.qualifying) return opts.currentStreak;

  if (opts.lastQuestDate === opts.today) {
    return Math.max(1, opts.currentStreak);
  }

  if (!opts.lastQuestDate) return 1;

  // Walk back work days from today until we hit lastQuest or a gap.
  const expectedPrev = prevWorkDay(opts.today, workDays);
  if (opts.lastQuestDate === expectedPrev || opts.lastQuestDate === opts.today) {
    return opts.currentStreak + (opts.lastQuestDate === opts.today ? 0 : 1);
  }

  // If last quest was on a more recent work day than expectedPrev somehow, keep.
  if (opts.lastQuestDate > expectedPrev) {
    return Math.max(1, opts.currentStreak);
  }

  // Allow last quest on any day since the previous work day (e.g. weekend session).
  if (opts.lastQuestDate >= expectedPrev || !isWorkDay(opts.lastQuestDate, workDays)) {
    // If they focused on an off day, treat next work day as continuation.
    const afterOff = prevWorkDay(opts.today, workDays);
    // Find most recent work day ≤ lastQuest
    let bridge = opts.lastQuestDate;
    if (!isWorkDay(bridge, workDays)) {
      // Last focus was weekend — chain continues if today is next work day after that weekend
      let cursor = addDays(bridge, 1);
      while (cursor < opts.today && !isWorkDay(cursor, workDays)) {
        cursor = addDays(cursor, 1);
      }
      if (cursor === opts.today || afterOff <= bridge) {
        return opts.currentStreak + 1;
      }
    }
  }

  if (opts.lastQuestDate === expectedPrev) return opts.currentStreak + 1;

  // Gap on a work day → reset
  return 1;
}

/**
 * Count consecutive qualifying work days ending at `today` (or yesterday if today empty).
 * `qualifyingDays` = set of ISO dates with enough focus.
 */
export function countWorkDayStreak(
  qualifyingDays: Set<string> | Record<string, number>,
  today: string,
  workDays: WorkDayMask = [...DEFAULT_WORK_DAYS],
  minMinutes = 25
): number {
  const has = (iso: string): boolean => {
    if (qualifyingDays instanceof Set) return qualifyingDays.has(iso);
    return (qualifyingDays[iso] || 0) >= minMinutes;
  };

  let streak = 0;
  let cursor = today;

  // If today is empty / off, start from previous work day
  if (!has(cursor)) {
    if (isWorkDay(cursor, workDays) && cursor === today) {
      cursor = prevWorkDay(today, workDays);
    } else if (!isWorkDay(cursor, workDays)) {
      cursor = prevWorkDay(today, workDays);
    } else {
      cursor = prevWorkDay(today, workDays);
    }
  }

  for (let i = 0; i < 800; i++) {
    if (!isWorkDay(cursor, workDays)) {
      cursor = prevWorkDay(cursor, workDays);
      continue;
    }
    if (has(cursor)) {
      streak += 1;
      cursor = prevWorkDay(cursor, workDays);
    } else {
      break;
    }
  }
  return streak;
}

export const STREAK_MILESTONES = [7, 30, 100] as const;

export function streakMilestoneReached(prev: number, next: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (prev < m && next >= m) return m;
  }
  return null;
}

export function normalizeWorkDays(raw: unknown): WorkDayMask {
  if (!Array.isArray(raw)) return [...DEFAULT_WORK_DAYS];
  const nums = raw.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return nums.length ? [...new Set(nums)].sort() : [...DEFAULT_WORK_DAYS];
}
