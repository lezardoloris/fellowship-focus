/**
 * Fellowship Focus — Points, Ladder & Stakes
 * Single source of truth for XP economy
 */

export const POINTS = {
  // ── Gains ──────────────────────────────────────────
  XP_PER_FOCUS_MINUTE: 1,
  DAILY_QUEST_MINUTES: 25,
  DAILY_QUEST_BONUS: 10,
  STREAK_BONUS_EVERY_7_DAYS: 50,
  SESSION_COMPLETE_BONUS: 5,
  ZERO_BLOCKS_SESSION_BONUS: 15,

  // ── Penalties (block page) ─────────────────────────
  BLOCK_BASE_PENALTY: 10,
  BLOCK_REPEAT_BONUS: 5, // +5 per block in same hour
  BLOCK_MAX_PENALTY: 30,
  BLOCK_FELLOWSHIP_TAX: 3, // fellowship pool also loses this

  // ── Ladder leagues (weekly NET xp) ─────────────────
  LEAGUES: [
    { id: "mordor", name: "Mordor", minNetXp: 500, color: "#c45c26" },
    { id: "gondor", name: "Gondor", minNetXp: 300, color: "#d4af37" },
    { id: "rohan", name: "Rohan", minNetXp: 150, color: "#c0c0c0" },
    { id: "shire", name: "Shire", minNetXp: 0, color: "#8b7355" },
  ],
} as const;

export function calcBlockPenalty(recentBlockCount: number): number {
  const penalty =
    POINTS.BLOCK_BASE_PENALTY + recentBlockCount * POINTS.BLOCK_REPEAT_BONUS;
  return Math.min(penalty, POINTS.BLOCK_MAX_PENALTY);
}

export function calcSessionXp(minutes: number, completed: boolean, hadBlocks: boolean): number {
  let xp = completed ? minutes * POINTS.XP_PER_FOCUS_MINUTE : Math.floor(minutes / 2);
  if (completed) xp += POINTS.SESSION_COMPLETE_BONUS;
  if (completed && minutes >= POINTS.DAILY_QUEST_MINUTES) xp += POINTS.DAILY_QUEST_BONUS;
  if (completed && !hadBlocks) xp += POINTS.ZERO_BLOCKS_SESSION_BONUS;
  return xp;
}

export function getLeague(netWeeklyXp: number) {
  for (const league of POINTS.LEAGUES) {
    if (netWeeklyXp >= league.minNetXp) return league;
  }
  return POINTS.LEAGUES[POINTS.LEAGUES.length - 1];
}
