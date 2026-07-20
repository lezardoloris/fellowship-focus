import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { calcBlockPenalty, calcSessionXp, getLeague, POINTS } from "./points";
import { HABIT_PRESETS, HABIT_XP, calcStakeScore, monthKey, todayDate } from "./habits";
import type { VerificationType } from "./habits";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "fellowship.db");

export type Fellowship = {
  id: string;
  code: string;
  name: string;
  created_at: string;
};

export type Member = {
  id: string;
  fellowship_id: string;
  name: string;
  token: string;
  total_xp: number;
  streak: number;
  last_quest_date: string | null;
  created_at: string;
};

export type FocusSession = {
  id: string;
  member_id: string;
  fellowship_id: string;
  minutes: number;
  xp_earned: number;
  completed: number;
  created_at: string;
};

export type BlockEvent = {
  id: string;
  member_id: string;
  fellowship_id: string;
  site: string;
  xp_penalty: number;
  created_at: string;
};

export type FeedEvent = {
  id: string;
  type: "session" | "block" | "join" | "waypoint" | "habit" | "stake";
  member_name: string;
  message: string;
  created_at: string;
};

export type MemberHabit = {
  id: string;
  member_id: string;
  fellowship_id: string;
  preset_id: string | null;
  label: string;
  emoji: string;
  verification: VerificationType;
  monthly_goal: number;
  active: number;
  created_at: string;
};

export type HabitCheckin = {
  id: string;
  habit_id: string;
  member_id: string;
  date: string;
  completed: number;
  verified_by: string;
  xp_awarded: number;
  created_at: string;
};

export type Stake = {
  id: string;
  fellowship_id: string;
  title: string;
  amount_cents: number;
  currency: string;
  week_start: string;
  min_habit_rate: number;
  max_blocks: number;
  status: string;
  escrow_transaction_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type StakeEntry = {
  id: string;
  stake_id: string;
  member_id: string;
  email: string | null;
  funded: number;
  outcome: string;
  escrow_transaction_id: string | null;
};

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS fellowships (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      fellowship_id TEXT NOT NULL,
      name TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      total_xp INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      last_quest_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (fellowship_id) REFERENCES fellowships(id)
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      fellowship_id TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      xp_earned INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (fellowship_id) REFERENCES fellowships(id)
    );

    CREATE TABLE IF NOT EXISTS block_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      fellowship_id TEXT NOT NULL,
      site TEXT NOT NULL,
      xp_penalty INTEGER NOT NULL DEFAULT 10,
      fellowship_tax INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (fellowship_id) REFERENCES fellowships(id)
    );

    CREATE TABLE IF NOT EXISTS feed_events (
      id TEXT PRIMARY KEY,
      fellowship_id TEXT NOT NULL,
      type TEXT NOT NULL,
      member_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (fellowship_id) REFERENCES fellowships(id)
    );

    CREATE INDEX IF NOT EXISTS idx_members_fellowship ON members(fellowship_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_fellowship ON focus_sessions(fellowship_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_member ON focus_sessions(member_id);
    CREATE INDEX IF NOT EXISTS idx_blocks_fellowship ON block_events(fellowship_id);
    CREATE INDEX IF NOT EXISTS idx_feed_fellowship ON feed_events(fellowship_id);

    CREATE TABLE IF NOT EXISTS member_habits (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      fellowship_id TEXT NOT NULL,
      preset_id TEXT,
      label TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      verification TEXT NOT NULL DEFAULT 'manual',
      monthly_goal INTEGER NOT NULL DEFAULT 20,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (fellowship_id) REFERENCES fellowships(id)
    );

    CREATE TABLE IF NOT EXISTS habit_checkins (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 1,
      verified_by TEXT NOT NULL DEFAULT 'manual',
      xp_awarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (habit_id) REFERENCES member_habits(id),
      UNIQUE(habit_id, date)
    );

    CREATE TABLE IF NOT EXISTS stakes (
      id TEXT PRIMARY KEY,
      fellowship_id TEXT NOT NULL,
      title TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      week_start TEXT NOT NULL,
      min_habit_rate INTEGER NOT NULL DEFAULT 70,
      max_blocks INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'open',
      escrow_transaction_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (fellowship_id) REFERENCES fellowships(id)
    );

    CREATE TABLE IF NOT EXISTS stake_entries (
      id TEXT PRIMARY KEY,
      stake_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      email TEXT,
      funded INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL DEFAULT 'pending',
      escrow_transaction_id TEXT,
      FOREIGN KEY (stake_id) REFERENCES stakes(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE INDEX IF NOT EXISTS idx_habits_member ON member_habits(member_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_habit ON habit_checkins(habit_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_date ON habit_checkins(date);
    CREATE INDEX IF NOT EXISTS idx_stakes_fellowship ON stakes(fellowship_id);
  `);
  try {
    database.exec(`ALTER TABLE block_events ADD COLUMN fellowship_tax INTEGER NOT NULL DEFAULT 3`);
  } catch {
    /* column exists */
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

export function createFellowship(name: string): Fellowship {
  const database = getDb();
  const id = nanoid();
  const code = `${slugify(name) || "fellowship"}-${nanoid(8)}`;
  database
    .prepare("INSERT INTO fellowships (id, code, name) VALUES (?, ?, ?)")
    .run(id, code, name);
  return database.prepare("SELECT * FROM fellowships WHERE id = ?").get(id) as Fellowship;
}

export function getFellowshipByCode(code: string): Fellowship | undefined {
  return getDb().prepare("SELECT * FROM fellowships WHERE code = ?").get(code) as Fellowship | undefined;
}

export function joinFellowship(fellowshipId: string, name: string): Member {
  const database = getDb();
  const id = nanoid();
  const token = nanoid(32);
  database
    .prepare(
      "INSERT INTO members (id, fellowship_id, name, token) VALUES (?, ?, ?, ?)"
    )
    .run(id, fellowshipId, name, token);
  addFeedEvent(fellowshipId, "join", name, `${name} joined the Fellowship.`);
  seedDefaultHabits(id, fellowshipId);
  return database.prepare("SELECT * FROM members WHERE id = ?").get(id) as Member;
}

function seedDefaultHabits(memberId: string, fellowshipId: string) {
  const database = getDb();
  const defaults = HABIT_PRESETS.filter((p) =>
    ["focus-quest", "clean-focus", "sport", "meditate"].includes(p.id)
  );
  for (const preset of defaults) {
    database
      .prepare(
        `INSERT INTO member_habits (id, member_id, fellowship_id, preset_id, label, emoji, verification, monthly_goal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nanoid(),
        memberId,
        fellowshipId,
        preset.id,
        preset.label,
        preset.emoji,
        preset.verification,
        preset.defaultGoal
      );
  }
}

export function getMemberByToken(token: string): Member | undefined {
  return getDb().prepare("SELECT * FROM members WHERE token = ?").get(token) as Member | undefined;
}

export function getMembers(fellowshipId: string): Member[] {
  return getDb()
    .prepare("SELECT * FROM members WHERE fellowship_id = ? ORDER BY total_xp DESC")
    .all(fellowshipId) as Member[];
}

export function getFellowshipTotalXp(fellowshipId: string): number {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(total_xp), 0) as total FROM members WHERE fellowship_id = ?")
    .get(fellowshipId) as { total: number };
  const tax = (
    getDb()
      .prepare(
        "SELECT COALESCE(SUM(fellowship_tax), 0) as t FROM block_events WHERE fellowship_id = ?"
      )
      .get(fellowshipId) as { t: number }
  ).t;
  return Math.max(0, row.total - tax);
}

export function logSession(
  memberId: string,
  fellowshipId: string,
  minutes: number,
  completed: boolean
): { session: FocusSession; member: Member; xpEarned: number } {
  const database = getDb();
  const sessionId = nanoid();

  const hourAgo = new Date(Date.now() - 3600000).toISOString().replace("T", " ").slice(0, 19);
  const recentBlocks = (
    database
      .prepare(
        "SELECT COUNT(*) as c FROM block_events WHERE member_id = ? AND created_at >= ?"
      )
      .get(memberId, hourAgo) as { c: number }
  ).c;
  const hadBlocks = recentBlocks > 0;

  const xpEarned = calcSessionXp(minutes, completed, hadBlocks);

  database
    .prepare(
      "INSERT INTO focus_sessions (id, member_id, fellowship_id, minutes, xp_earned, completed) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(sessionId, memberId, fellowshipId, minutes, xpEarned, completed ? 1 : 0);

  const member = database.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let newStreak = member.streak;
  if (completed && minutes >= 25) {
    if (member.last_quest_date === today) {
      newStreak = member.streak;
    } else if (member.last_quest_date === yesterday) {
      newStreak = member.streak + 1;
    } else {
      newStreak = 1;
    }
  }

  let bonusXp = 0;
  if (newStreak > 0 && newStreak % 7 === 0 && member.last_quest_date !== today) {
    bonusXp = POINTS.STREAK_BONUS_EVERY_7_DAYS;
  }

  const totalXpGain = xpEarned + bonusXp;
  database
    .prepare(
      "UPDATE members SET total_xp = total_xp + ?, streak = ?, last_quest_date = CASE WHEN ? >= 25 AND ? = 1 THEN ? ELSE last_quest_date END WHERE id = ?"
    )
    .run(totalXpGain, newStreak, minutes, completed ? 1 : 0, today, memberId);

  const updatedMember = database.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member;
  const session = database.prepare("SELECT * FROM focus_sessions WHERE id = ?").get(sessionId) as FocusSession;

  if (completed) {
    addFeedEvent(
      fellowshipId,
      "session",
      member.name,
      `${member.name} completed ${minutes} min of focus (+${totalXpGain} XP).`
    );
  }

  syncAutoHabits(memberId, fellowshipId);

  return { session, member: updatedMember, xpEarned: totalXpGain };
}

export function logBlock(
  memberId: string,
  fellowshipId: string,
  site: string
): {
  penalty: number;
  fellowship_tax: number;
  member: Member;
  member_name: string;
  weekly_net: number;
  rank: number;
  total_members: number;
} {
  const database = getDb();
  const hourAgo = new Date(Date.now() - 3600000).toISOString().replace("T", " ").slice(0, 19);
  const recentBlocks = (
    database
      .prepare(
        "SELECT COUNT(*) as c FROM block_events WHERE member_id = ? AND created_at >= ?"
      )
      .get(memberId, hourAgo) as { c: number }
  ).c;

  const penalty = calcBlockPenalty(recentBlocks);
  const fellowship_tax = POINTS.BLOCK_FELLOWSHIP_TAX;
  const id = nanoid();
  const member = database.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member;

  database
    .prepare(
      "INSERT INTO block_events (id, member_id, fellowship_id, site, xp_penalty, fellowship_tax) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, memberId, fellowshipId, site, penalty, fellowship_tax);

  database
    .prepare("UPDATE members SET total_xp = MAX(0, total_xp - ?) WHERE id = ?")
    .run(penalty, memberId);

  addFeedEvent(
    fellowshipId,
    "block",
    member.name,
    `${member.name} hit the block page on ${site} (−${penalty} XP · Fellowship −${fellowship_tax} XP).`
  );

  const updatedMember = database.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member;
  const leaderboard = getWeeklyLeaderboard(fellowshipId);
  const entry = leaderboard.find((m) => m.id === memberId);
  const weekly_net = entry?.weekly_net ?? 0;
  const rank = leaderboard.findIndex((m) => m.id === memberId) + 1;

  syncAutoHabits(memberId, fellowshipId);

  return {
    penalty,
    fellowship_tax,
    member: updatedMember,
    member_name: member.name,
    weekly_net,
    rank,
    total_members: leaderboard.length,
  };
}

function addFeedEvent(
  fellowshipId: string,
  type: FeedEvent["type"],
  memberName: string,
  message: string
) {
  getDb()
    .prepare(
      "INSERT INTO feed_events (id, fellowship_id, type, member_name, message) VALUES (?, ?, ?, ?, ?)"
    )
    .run(nanoid(), fellowshipId, type, memberName, message);
}

export function getFeed(fellowshipId: string, limit = 20): FeedEvent[] {
  return getDb()
    .prepare(
      "SELECT id, type, member_name, message, created_at FROM feed_events WHERE fellowship_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(fellowshipId, limit) as FeedEvent[];
}

export function getWeeklyLeaderboard(
  fellowshipId: string
): Array<Member & { weekly_xp: number; weekly_penalties: number; weekly_net: number; league: string }> {
  const weekStart = getWeekStartSql();
  const rows = getDb()
    .prepare(
      `
      SELECT m.*,
        COALESCE((SELECT SUM(fs.xp_earned) FROM focus_sessions fs
          WHERE fs.member_id = m.id AND fs.created_at >= ?), 0) as weekly_xp,
        COALESCE((SELECT SUM(be.xp_penalty) FROM block_events be
          WHERE be.member_id = m.id AND be.created_at >= ?), 0) as weekly_penalties
      FROM members m
      WHERE m.fellowship_id = ?
    `
    )
    .all(weekStart, weekStart, fellowshipId) as Array<
    Member & { weekly_xp: number; weekly_penalties: number }
  >;

  return rows
    .map((m) => ({
      ...m,
      weekly_net: m.weekly_xp - m.weekly_penalties,
      league: getLeague(m.weekly_xp - m.weekly_penalties).name,
    }))
    .sort((a, b) => b.weekly_net - a.weekly_net || b.total_xp - a.total_xp);
}

function getWeekStartSql(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().replace("T", " ").slice(0, 19);
}

export function getFellowshipStats(fellowshipId: string) {
  const database = getDb();
  const totalXp = getFellowshipTotalXp(fellowshipId);
  const totalSessions = (
    database
      .prepare("SELECT COUNT(*) as c FROM focus_sessions WHERE fellowship_id = ? AND completed = 1")
      .get(fellowshipId) as { c: number }
  ).c;
  const totalBlocks = (
    database.prepare("SELECT COUNT(*) as c FROM block_events WHERE fellowship_id = ?").get(fellowshipId) as {
      c: number;
    }
  ).c;
  const totalMinutes = (
    database
      .prepare("SELECT COALESCE(SUM(minutes), 0) as m FROM focus_sessions WHERE fellowship_id = ?")
      .get(fellowshipId) as { m: number }
  ).m;
  return { totalXp, totalSessions, totalBlocks, totalMinutes };
}

// ── Habits ─────────────────────────────────────────────

export function getMemberHabits(memberId: string): MemberHabit[] {
  return getDb()
    .prepare("SELECT * FROM member_habits WHERE member_id = ? AND active = 1 ORDER BY created_at")
    .all(memberId) as MemberHabit[];
}

export function addMemberHabit(
  memberId: string,
  fellowshipId: string,
  presetId: string
): MemberHabit | null {
  const preset = HABIT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const database = getDb();
  const existing = database
    .prepare("SELECT id FROM member_habits WHERE member_id = ? AND preset_id = ? AND active = 1")
    .get(memberId, presetId);
  if (existing) return null;

  const id = nanoid();
  database
    .prepare(
      `INSERT INTO member_habits (id, member_id, fellowship_id, preset_id, label, emoji, verification, monthly_goal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, memberId, fellowshipId, preset.id, preset.label, preset.emoji, preset.verification, preset.defaultGoal);
  return database.prepare("SELECT * FROM member_habits WHERE id = ?").get(id) as MemberHabit;
}

export function syncAutoHabits(memberId: string, fellowshipId: string) {
  const database = getDb();
  const habits = getMemberHabits(memberId);
  const today = todayDate();

  for (const habit of habits) {
    if (habit.verification === "auto_focus") {
      const session = database
        .prepare(
          `SELECT COUNT(*) as c FROM focus_sessions
           WHERE member_id = ? AND completed = 1 AND minutes >= 25
           AND date(created_at) = ?`
        )
        .get(memberId, today) as { c: number };
      if (session.c > 0) upsertCheckin(habit.id, memberId, today, true, "auto_focus", false);
    }
    if (habit.verification === "auto_clean") {
      const blocks = database
        .prepare(`SELECT COUNT(*) as c FROM block_events WHERE member_id = ? AND date(created_at) = ?`)
        .get(memberId, today) as { c: number };
      const sessions = database
        .prepare(
          `SELECT COUNT(*) as c FROM focus_sessions WHERE member_id = ? AND completed = 1 AND date(created_at) = ?`
        )
        .get(memberId, today) as { c: number };
      if (sessions.c > 0 && blocks.c === 0) upsertCheckin(habit.id, memberId, today, true, "auto_clean", false);
    }
  }
  void fellowshipId;
}

function upsertCheckin(
  habitId: string,
  memberId: string,
  date: string,
  completed: boolean,
  verifiedBy: string,
  awardXp: boolean
) {
  const database = getDb();
  const existing = database
    .prepare("SELECT * FROM habit_checkins WHERE habit_id = ? AND date = ?")
    .get(habitId, date) as HabitCheckin | undefined;

  if (existing) {
    if (existing.completed === (completed ? 1 : 0)) return;
    database
      .prepare("UPDATE habit_checkins SET completed = ?, verified_by = ? WHERE id = ?")
      .run(completed ? 1 : 0, verifiedBy, existing.id);
    return;
  }

  if (!completed) return;

  let xp = 0;
  if (awardXp) {
    xp = HABIT_XP.PER_CHECKIN;
    database.prepare("UPDATE members SET total_xp = total_xp + ? WHERE id = ?").run(xp, memberId);
  }

  database
    .prepare(
      `INSERT INTO habit_checkins (id, habit_id, member_id, date, completed, verified_by, xp_awarded)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    )
    .run(nanoid(), habitId, memberId, date, verifiedBy, xp);
}

export function toggleHabitCheckin(
  memberId: string,
  habitId: string,
  date: string,
  fellowshipId: string
): { completed: boolean; xpAwarded: number } {
  const database = getDb();
  const habit = database
    .prepare("SELECT * FROM member_habits WHERE id = ? AND member_id = ? AND verification = 'manual'")
    .get(habitId, memberId) as MemberHabit | undefined;
  if (!habit) throw new Error("Habit not found or not manual");

  const existing = database
    .prepare("SELECT * FROM habit_checkins WHERE habit_id = ? AND date = ?")
    .get(habitId, date) as HabitCheckin | undefined;

  const member = database.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member;

  if (existing?.completed) {
    database.prepare("DELETE FROM habit_checkins WHERE id = ?").run(existing.id);
    if (existing.xp_awarded > 0) {
      database
        .prepare("UPDATE members SET total_xp = MAX(0, total_xp - ?) WHERE id = ?")
        .run(existing.xp_awarded, memberId);
    }
    return { completed: false, xpAwarded: 0 };
  }

  const xp = HABIT_XP.PER_CHECKIN;
  database
    .prepare(
      `INSERT INTO habit_checkins (id, habit_id, member_id, date, completed, verified_by, xp_awarded)
       VALUES (?, ?, ?, ?, 1, 'manual', ?)`
    )
    .run(nanoid(), habitId, memberId, date, xp);
  database.prepare("UPDATE members SET total_xp = total_xp + ? WHERE id = ?").run(xp, memberId);

  addFeedEvent(
    fellowshipId,
    "habit",
    member.name,
    `${member.name} checked in: ${habit.emoji} ${habit.label} (+${xp} XP).`
  );

  return { completed: true, xpAwarded: xp };
}

export function getHabitGrid(memberId: string, year: number, month: number) {
  syncAutoHabits(memberId, "");
  const database = getDb();
  const mk = monthKey(year, month);
  const habits = getMemberHabits(memberId);

  return habits.map((habit) => {
    const checkins = database
      .prepare(
        `SELECT date, completed, verified_by FROM habit_checkins
         WHERE habit_id = ? AND date LIKE ?`
      )
      .all(habit.id, `${mk}%`) as Array<{ date: string; completed: number; verified_by: string }>;

    const byDate: Record<string, { completed: boolean; verified_by: string }> = {};
    for (const c of checkins) {
      byDate[c.date] = { completed: c.completed === 1, verified_by: c.verified_by };
    }

    const achieved = checkins.filter((c) => c.completed === 1).length;
    return {
      ...habit,
      achieved,
      goal: habit.monthly_goal,
      completionRate: habit.monthly_goal > 0 ? Math.round((achieved / habit.monthly_goal) * 100) : 0,
      checkins: byDate,
    };
  });
}

export function getFellowshipHabitLeaderboard(fellowshipId: string) {
  const members = getMembers(fellowshipId);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return members.map((m) => {
    syncAutoHabits(m.id, fellowshipId);
    const grid = getHabitGrid(m.id, year, month);
    const totalGoal = grid.reduce((s, h) => s + h.goal, 0);
    const totalAchieved = grid.reduce((s, h) => s + h.achieved, 0);
    const stakeScore = calcStakeScore(
      grid.map((h) => ({ verification: h.verification as VerificationType, achieved: h.achieved, goal: h.goal }))
    );
    return {
      member_id: m.id,
      name: m.name,
      habits_count: grid.length,
      total_goal: totalGoal,
      total_achieved: totalAchieved,
      completion_rate: totalGoal > 0 ? Math.round((totalAchieved / totalGoal) * 100) : 0,
      stake_score: stakeScore,
      habits: grid,
    };
  }).sort((a, b) => b.stake_score - a.stake_score || b.completion_rate - a.completion_rate);
}

// ── Stakes ─────────────────────────────────────────────

export function createStake(
  fellowshipId: string,
  createdBy: string,
  title: string,
  amountCents: number,
  minHabitRate: number,
  maxBlocks: number
): Stake {
  const database = getDb();
  const id = nanoid();
  const weekStart = getWeekStartSql().slice(0, 10);
  database
    .prepare(
      `INSERT INTO stakes (id, fellowship_id, title, amount_cents, week_start, min_habit_rate, max_blocks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, fellowshipId, title, amountCents, weekStart, minHabitRate, maxBlocks, createdBy);

  const members = getMembers(fellowshipId);
  for (const m of members) {
    database
      .prepare("INSERT INTO stake_entries (id, stake_id, member_id) VALUES (?, ?, ?)")
      .run(nanoid(), id, m.id);
  }

  const creator = database.prepare("SELECT name FROM members WHERE id = ?").get(createdBy) as { name: string };
  addFeedEvent(
    fellowshipId,
    "stake",
    creator.name,
    `${creator.name} opened a weekly stake: ${title} (€${(amountCents / 100).toFixed(0)}/person).`
  );

  return database.prepare("SELECT * FROM stakes WHERE id = ?").get(id) as Stake;
}

export function getActiveStake(fellowshipId: string): (Stake & { entries: StakeEntry[] }) | null {
  const database = getDb();
  const stake = database
    .prepare(
      `SELECT * FROM stakes WHERE fellowship_id = ? AND status IN ('open', 'active')
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(fellowshipId) as Stake | undefined;
  if (!stake) return null;

  const entries = database
    .prepare("SELECT * FROM stake_entries WHERE stake_id = ?")
    .all(stake.id) as StakeEntry[];

  return { ...stake, entries };
}

export function joinStakeEntry(
  stakeId: string,
  memberId: string,
  email: string,
  escrowTransactionId?: string
) {
  const database = getDb();
  database
    .prepare(
      `UPDATE stake_entries SET email = ?, funded = 1, escrow_transaction_id = ?
       WHERE stake_id = ? AND member_id = ?`
    )
    .run(email, escrowTransactionId ?? null, stakeId, memberId);
  database.prepare("UPDATE stakes SET status = 'active' WHERE id = ?").run(stakeId);
}

export function evaluateStakeOutcomes(fellowshipId: string) {
  const stake = getActiveStake(fellowshipId);
  if (!stake) return null;

  const database = getDb();
  const weekStart = stake.week_start;
  const habitBoard = getFellowshipHabitLeaderboard(fellowshipId);

  for (const entry of stake.entries) {
    const memberHabits = habitBoard.find((h) => h.member_id === entry.member_id);
    const blocks = (
      database
        .prepare(
          `SELECT COUNT(*) as c FROM block_events WHERE member_id = ? AND date(created_at) >= ?`
        )
        .get(entry.member_id, weekStart) as { c: number }
    ).c;

    const habitOk = (memberHabits?.stake_score ?? 0) >= stake.min_habit_rate;
    const blocksOk = blocks <= stake.max_blocks;
    const outcome = habitOk && blocksOk ? "winner" : blocks > stake.max_blocks ? "forfeited" : "partial";

    database
      .prepare("UPDATE stake_entries SET outcome = ? WHERE id = ?")
      .run(outcome, entry.id);
  }

  database.prepare("UPDATE stakes SET status = 'settled' WHERE id = ?").run(stake.id);
  return getActiveStake(fellowshipId);
}
