import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { calcBlockPenalty, calcSessionXp, getLeague, POINTS } from "./points";
import { HABIT_MARKS, HABIT_PRESETS, HABIT_XP, calcStakeScore, monthKey, resolveHabitMarkId, todayDate } from "./habits";
import type { VerificationType } from "./habits";
import {
  type FocusProof,
  type ProofPrivacyTier,
  type ProofType,
  purgeOldProofs,
  saveProofThumb,
} from "./proofs";
import {
  mergeBlockerSettings,
  type BlockerSettings,
  DEFAULT_BLOCKER_SETTINGS,
} from "./blockerSettings";
import {
  hashToken,
  looksLikeLegacyPlaintext,
  mintToken,
  openToken,
  sealToken,
} from "./tokens";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "fellowship.db");

// On Railway the container filesystem is ephemeral. Without DATA_DIR pointing at
// a mounted volume, every redeploy silently wipes fellowships, XP and stakes —
// the symptom is fellowship codes suddenly 404ing. Make that loud. See
// web/railway.toml for the one-time volume setup.
if (process.env.NODE_ENV === "production" && !process.env.DATA_DIR) {
  console.warn(
    `[fellowship] DATA_DIR is not set — the database at ${DB_PATH} lives on ` +
      `ephemeral storage and WILL be lost on the next deploy. ` +
      `Set DATA_DIR=/data and mount a volume there.`
  );
}

export type Fellowship = {
  id: string;
  code: string;
  name: string;
  niche: string;
  objective: string;
  visibility: "public" | "private";
  blocker_bypass_penalty: number;
  created_at: string;
};

export type PublicGuildCard = {
  code: string;
  name: string;
  niche: string;
  objective: string;
  member_count: number;
  total_xp: number;
  blocker_bypass_penalty: number;
  created_at: string;
};

export const GUILD_NICHES = [
  { id: "builders", label: "Builders", blurb: "Ship products, code, startups" },
  { id: "students", label: "Students", blurb: "Exams, deep study, no doomscroll" },
  { id: "creators", label: "Creators", blurb: "Content, design, writing streaks" },
  { id: "fitness", label: "Fitness", blurb: "Training + focus habits" },
  { id: "deep-work", label: "Deep Work", blurb: "Long blocks, zero distractions" },
  { id: "accountability", label: "Accountability", blurb: "Check-ins, stakes, peer pressure" },
] as const;

export type Member = {
  id: string;
  fellowship_id: string;
  name: string;
  /** SHA-256 hex of bearer (or legacy plaintext until migrated). */
  token: string;
  /** AES vault of plaintext for authenticated re-issue; null if revoked. */
  token_enc?: string | null;
  total_xp: number;
  streak: number;
  last_quest_date: string | null;
  created_at: string;
};

export type GoogleUser = {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  /** SHA-256 hex of bearer (or legacy plaintext until migrated). */
  token: string;
  token_enc?: string | null;
  member_id: string | null;
  created_at: string;
};

export type HistorySuggestion = {
  owner_id: string;
  domain: string;
  visits: number;
  score: number;
  last_visit: number | null;
  updated_at: string;
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
  type: "session" | "block" | "join" | "waypoint" | "habit" | "stake" | "proof";
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

    CREATE TABLE IF NOT EXISTS focus_proofs (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      member_id TEXT NOT NULL,
      fellowship_id TEXT NOT NULL,
      proof_type TEXT NOT NULL,
      privacy_tier TEXT NOT NULL DEFAULT 'signal',
      active_app TEXT,
      thumb_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (fellowship_id) REFERENCES fellowships(id)
    );

    CREATE INDEX IF NOT EXISTS idx_proofs_fellowship ON focus_proofs(fellowship_id);
    CREATE INDEX IF NOT EXISTS idx_proofs_member ON focus_proofs(member_id);
    CREATE INDEX IF NOT EXISTS idx_proofs_session ON focus_proofs(session_id);

    CREATE TABLE IF NOT EXISTS app_usage (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      fellowship_id TEXT NOT NULL,
      date TEXT NOT NULL,
      work_seconds INTEGER NOT NULL DEFAULT 0,
      distraction_seconds INTEGER NOT NULL DEFAULT 0,
      personal_seconds INTEGER NOT NULL DEFAULT 0,
      neutral_seconds INTEGER NOT NULL DEFAULT 0,
      focus_score INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (fellowship_id) REFERENCES fellowships(id),
      UNIQUE(member_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_fellowship ON app_usage(fellowship_id);
    CREATE INDEX IF NOT EXISTS idx_usage_member ON app_usage(member_id);

    CREATE TABLE IF NOT EXISTS member_blocklist (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      site TEXT NOT NULL,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id),
      UNIQUE(member_id, site)
    );

    CREATE INDEX IF NOT EXISTS idx_blocklist_member ON member_blocklist(member_id);

    CREATE TABLE IF NOT EXISTS member_prefs (
      member_id TEXT PRIMARY KEY,
      focus_min INTEGER NOT NULL DEFAULT 25,
      break_min INTEGER NOT NULL DEFAULT 5,
      cycles INTEGER NOT NULL DEFAULT 4,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS member_goals (
      member_id TEXT PRIMARY KEY,
      focus_hours_target INTEGER NOT NULL DEFAULT 20,
      habit_rate_target INTEGER NOT NULL DEFAULT 80,
      revenue_target_cents INTEGER NOT NULL DEFAULT 300000,
      revenue_current_cents INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS google_users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      token TEXT UNIQUE NOT NULL,
      member_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS history_suggestions (
      owner_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      visits INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      last_visit INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (owner_id, domain)
    );
  `);
  try {
    database.exec(`ALTER TABLE block_events ADD COLUMN fellowship_tax INTEGER NOT NULL DEFAULT 3`);
  } catch {
    /* column exists */
  }
  try {
    database.exec(
      `ALTER TABLE fellowships ADD COLUMN blocker_bypass_penalty INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    /* column exists */
  }
  try {
    database.exec(
      `ALTER TABLE focus_sessions ADD COLUMN blocker_bypassed INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    /* column exists */
  }
  try {
    database.exec(`ALTER TABLE focus_sessions ADD COLUMN activity_score INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* column exists */
  }
  try {
    // Which block of work the session belonged to (PERSO.xlsx Quotidien).
    database.exec(
      `ALTER TABLE focus_sessions ADD COLUMN activity TEXT NOT NULL DEFAULT 'other'`
    );
  } catch {
    /* column exists */
  }
  try {
    database.exec(`ALTER TABLE fellowships ADD COLUMN niche TEXT NOT NULL DEFAULT 'deep-work'`);
  } catch {
    /* column exists */
  }
  try {
    database.exec(`ALTER TABLE fellowships ADD COLUMN objective TEXT NOT NULL DEFAULT ''`);
  } catch {
    /* column exists */
  }
  try {
    database.exec(`ALTER TABLE fellowships ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`);
  } catch {
    /* column exists */
  }
  try {
    database.exec(`ALTER TABLE member_prefs ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}'`);
  } catch {
    /* column exists */
  }
  try {
    database.exec(`ALTER TABLE members ADD COLUMN token_enc TEXT`);
  } catch {
    /* column exists */
  }
  try {
    database.exec(`ALTER TABLE google_users ADD COLUMN token_enc TEXT`);
  } catch {
    /* column exists */
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS blocker_devices (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      shield_on INTEGER NOT NULL DEFAULT 0,
      meta TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
    CREATE TABLE IF NOT EXISTS pair_codes (
      code TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
    CREATE TABLE IF NOT EXISTS bypass_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);
  purgeOldProofs(database);
  seedPublicGuilds(database);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

export function createFellowship(
  name: string,
  blockerBypassPenalty = 0,
  opts?: {
    niche?: string;
    objective?: string;
    visibility?: "public" | "private";
    code?: string;
  }
): Fellowship {
  const database = getDb();
  const id = nanoid();
  const code = (
    opts?.code || `${slugify(name) || "fellowship"}-${nanoid(8)}`
  ).toLowerCase();
  const penalty = Math.max(0, Math.min(100, blockerBypassPenalty));
  const niche = (opts?.niche || "deep-work").toLowerCase().slice(0, 40);
  const objective = (opts?.objective || "").trim().slice(0, 280);
  const visibility = opts?.visibility === "public" ? "public" : "private";
  database
    .prepare(
      `INSERT INTO fellowships (id, code, name, blocker_bypass_penalty, niche, objective, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, code, name, penalty, niche, objective, visibility);
  return database.prepare("SELECT * FROM fellowships WHERE id = ?").get(id) as Fellowship;
}

export function getFellowshipById(id: string): Fellowship | undefined {
  return getDb().prepare("SELECT * FROM fellowships WHERE id = ?").get(id) as Fellowship | undefined;
}

export function getFellowshipByCode(code: string): Fellowship | undefined {
  ensurePublicGuilds();
  const clean = code.trim().toLowerCase();
  const database = getDb();
  const exact = database
    .prepare("SELECT * FROM fellowships WHERE lower(code) = ?")
    .get(clean) as Fellowship | undefined;
  if (exact) return exact;

  // Old random seeds used `${slug}-${nanoid}` — map those back to stable starter codes.
  const starterCodes = [
    "the-shire-builders",
    "rohan-study-hall",
    "gondor-creators",
    "mordor-deep-work",
    "fellowship-of-sweat",
    "council-of-accountability",
  ];
  for (const starter of starterCodes) {
    if (clean === starter || clean.startsWith(`${starter}-`)) {
      const row = database
        .prepare("SELECT * FROM fellowships WHERE lower(code) = ?")
        .get(starter) as Fellowship | undefined;
      if (row) return row;
    }
  }
  return undefined;
}

export function listPublicGuilds(niche?: string | null): PublicGuildCard[] {
  ensurePublicGuilds();
  const database = getDb();
  const sql = niche
    ? `SELECT f.code, f.name, f.niche, f.objective, f.blocker_bypass_penalty, f.created_at,
              COUNT(m.id) as member_count,
              COALESCE(SUM(m.total_xp), 0) as total_xp
       FROM fellowships f
       LEFT JOIN members m ON m.fellowship_id = f.id
       WHERE f.visibility = 'public' AND f.niche = ?
       GROUP BY f.id
       ORDER BY total_xp DESC, member_count DESC, f.created_at DESC`
    : `SELECT f.code, f.name, f.niche, f.objective, f.blocker_bypass_penalty, f.created_at,
              COUNT(m.id) as member_count,
              COALESCE(SUM(m.total_xp), 0) as total_xp
       FROM fellowships f
       LEFT JOIN members m ON m.fellowship_id = f.id
       WHERE f.visibility = 'public'
       GROUP BY f.id
       ORDER BY total_xp DESC, member_count DESC, f.created_at DESC`;
  const rows = niche
    ? (database.prepare(sql).all(niche) as PublicGuildCard[])
    : (database.prepare(sql).all() as PublicGuildCard[]);
  return rows;
}

function seedPublicGuilds(database: Database.Database) {
  const starters: Array<{
    code: string;
    name: string;
    niche: string;
    objective: string;
    penalty: number;
  }> = [
    {
      code: "the-shire-builders",
      name: "The Shire Builders",
      niche: "builders",
      objective: "Ship one meaningful thing this week. No doomscroll while building.",
      penalty: 5,
    },
    {
      code: "rohan-study-hall",
      name: "Rohan Study Hall",
      niche: "students",
      objective: "Protect deep study blocks. Block social until the session ends.",
      penalty: 5,
    },
    {
      code: "gondor-creators",
      name: "Gondor Creators",
      niche: "creators",
      objective: "Daily creation streak — publish or practice before entertainment.",
      penalty: 5,
    },
    {
      code: "mordor-deep-work",
      name: "Mordor Deep Work",
      niche: "deep-work",
      objective: "Long focus quests. Distractions are the enemy.",
      penalty: 5,
    },
    {
      code: "fellowship-of-sweat",
      name: "Fellowship of Sweat",
      niche: "fitness",
      objective: "Train + focus. Log sessions, keep the streak alive.",
      penalty: 5,
    },
    {
      code: "council-of-accountability",
      name: "Council of Accountability",
      niche: "accountability",
      objective: "Public check-ins. Bypass the blocker and the guild feels it.",
      penalty: 15,
    },
  ];

  const insert = database.prepare(
    `INSERT OR IGNORE INTO fellowships (id, code, name, blocker_bypass_penalty, niche, objective, visibility)
     VALUES (?, ?, ?, ?, ?, ?, 'public')`
  );
  for (const s of starters) {
    const exists = database
      .prepare(`SELECT id FROM fellowships WHERE lower(code) = ?`)
      .get(s.code) as { id: string } | undefined;
    if (exists) continue;
    insert.run(nanoid(), s.code, s.name, s.penalty, s.niche, s.objective);
  }
}

function ensurePublicGuilds() {
  seedPublicGuilds(getDb());
}

export function joinFellowship(
  fellowshipId: string,
  name: string
): { member: Member; plaintextToken: string } {
  const database = getDb();
  const id = nanoid();
  const plaintextToken = mintToken();
  const tokenHash = hashToken(plaintextToken);
  const tokenEnc = sealToken(plaintextToken);
  database
    .prepare(
      "INSERT INTO members (id, fellowship_id, name, token, token_enc) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, fellowshipId, name, tokenHash, tokenEnc);
  addFeedEvent(fellowshipId, "join", name, `${name} joined the Fellowship.`);
  seedDefaultHabits(id, fellowshipId);
  const member = database.prepare("SELECT * FROM members WHERE id = ?").get(id) as Member;
  return { member, plaintextToken };
}

/** Reveal plaintext for authenticated owners (session-user). Null if revoked. */
export function revealMemberToken(memberId: string): string | null {
  const row = getDb()
    .prepare("SELECT token, token_enc FROM members WHERE id = ?")
    .get(memberId) as { token: string; token_enc: string | null } | undefined;
  if (!row) return null;
  if (row.token_enc) {
    const opened = openToken(row.token_enc);
    if (opened) return opened;
  }
  if (looksLikeLegacyPlaintext(row.token)) return row.token;
  return null;
}

/** Rotate bearer; returns new plaintext once. Invalidates extension/desktop until re-pair. */
export function rotateMemberToken(memberId: string): string | null {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM members WHERE id = ?").get(memberId) as
    | { id: string }
    | undefined;
  if (!existing) return null;
  const plaintext = mintToken();
  const tokenHash = hashToken(plaintext);
  const tokenEnc = sealToken(plaintext);
  database
    .prepare("UPDATE members SET token = ?, token_enc = ? WHERE id = ?")
    .run(tokenHash, tokenEnc, memberId);
  database
    .prepare("UPDATE google_users SET token = ?, token_enc = ? WHERE member_id = ?")
    .run(tokenHash, tokenEnc, memberId);
  return plaintext;
}

/** Revoke bearer — lookups fail; vault cleared. */
export function revokeMemberToken(memberId: string): boolean {
  const database = getDb();
  const dead = hashToken(mintToken());
  const info = database
    .prepare("UPDATE members SET token = ?, token_enc = NULL WHERE id = ?")
    .run(dead, memberId);
  database
    .prepare("UPDATE google_users SET token = ?, token_enc = NULL WHERE member_id = ?")
    .run(dead, memberId);
  return info.changes > 0;
}

function migrateLegacyMemberToken(row: Member, plaintext: string): Member {
  if (!looksLikeLegacyPlaintext(row.token)) return row;
  const database = getDb();
  const tokenHash = hashToken(plaintext);
  const tokenEnc = sealToken(plaintext);
  database
    .prepare("UPDATE members SET token = ?, token_enc = COALESCE(token_enc, ?) WHERE id = ?")
    .run(tokenHash, tokenEnc, row.id);
  database
    .prepare(
      "UPDATE google_users SET token = ?, token_enc = COALESCE(token_enc, ?) WHERE member_id = ? OR token = ?"
    )
    .run(tokenHash, tokenEnc, row.id, plaintext);
  return database.prepare("SELECT * FROM members WHERE id = ?").get(row.id) as Member;
}

export function getMemberByToken(token: string): Member | undefined {
  if (!token) return undefined;
  const database = getDb();
  const hashed = hashToken(token);
  const byHash = database.prepare("SELECT * FROM members WHERE token = ?").get(hashed) as
    | Member
    | undefined;
  if (byHash) return byHash;
  // Legacy plaintext rows (pre-hash migration).
  const legacy = database.prepare("SELECT * FROM members WHERE token = ?").get(token) as
    | Member
    | undefined;
  if (legacy && looksLikeLegacyPlaintext(legacy.token)) {
    return migrateLegacyMemberToken(legacy, token);
  }
  return undefined;
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

export function startFocusSession(memberId: string, fellowshipId: string): string {
  const sessionId = nanoid();
  getDb()
    .prepare(
      "INSERT INTO focus_sessions (id, member_id, fellowship_id, minutes, xp_earned, completed) VALUES (?, ?, ?, 0, 0, 0)"
    )
    .run(sessionId, memberId, fellowshipId);
  return sessionId;
}

export function logSession(
  memberId: string,
  fellowshipId: string,
  minutes: number,
  completed: boolean,
  existingSessionId?: string,
  activityScore = 0
): { session: FocusSession; member: Member; xpEarned: number } {
  const database = getDb();
  const sessionId = existingSessionId || nanoid();

  const hourAgo = new Date(Date.now() - 3600000).toISOString().replace("T", " ").slice(0, 19);
  const recentBlocks = (
    database
      .prepare(
        "SELECT COUNT(*) as c FROM block_events WHERE member_id = ? AND created_at >= ?"
      )
      .get(memberId, hourAgo) as { c: number }
  ).c;
  const hadBlocks = recentBlocks > 0;

  let blockerBypassed = false;
  if (existingSessionId) {
    const row = database
      .prepare("SELECT blocker_bypassed FROM focus_sessions WHERE id = ? AND member_id = ?")
      .get(sessionId, memberId) as { blocker_bypassed: number } | undefined;
    blockerBypassed = Boolean(row?.blocker_bypassed);
  }

  const xpEarned = calcSessionXp(minutes, completed, hadBlocks, blockerBypassed);

  if (existingSessionId) {
    database
      .prepare(
        `UPDATE focus_sessions SET minutes = ?, xp_earned = ?, completed = ?, activity_score = ?
         WHERE id = ? AND member_id = ?`
      )
      .run(minutes, xpEarned, completed ? 1 : 0, activityScore, sessionId, memberId);
  } else {
    database
      .prepare(
        "INSERT INTO focus_sessions (id, member_id, fellowship_id, minutes, xp_earned, completed) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(sessionId, memberId, fellowshipId, minutes, xpEarned, completed ? 1 : 0);
  }

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

export function logBlockerBypass(
  memberId: string,
  fellowshipId: string,
  sessionId: string
): { penalty: number; member: Member } | null {
  const database = getDb();
  const fellowship = getFellowshipById(fellowshipId);
  const penalty = fellowship?.blocker_bypass_penalty ?? 0;
  if (penalty <= 0) {
    database
      .prepare(
        "UPDATE focus_sessions SET blocker_bypassed = 1 WHERE id = ? AND member_id = ?"
      )
      .run(sessionId, memberId);
    return null;
  }

  const member = database.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member;
  database
    .prepare(
      "UPDATE focus_sessions SET blocker_bypassed = 1 WHERE id = ? AND member_id = ?"
    )
    .run(sessionId, memberId);
  database
    .prepare(
      "UPDATE members SET total_xp = CASE WHEN total_xp > ? THEN total_xp - ? ELSE 0 END WHERE id = ?"
    )
    .run(penalty, penalty, memberId);
  addFeedEvent(
    fellowshipId,
    "block",
    member.name,
    `${member.name} disabled the blocker during focus (−${penalty} XP).`
  );
  const updated = database.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Member;
  return { penalty, member: updated };
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
): Array<Member & { weekly_xp: number; weekly_penalties: number; weekly_net: number; league: string; today_minutes: number }> {
  const weekStart = getWeekStartSql();
  const rows = getDb()
    .prepare(
      `
      SELECT m.*,
        COALESCE((SELECT SUM(fs.xp_earned) FROM focus_sessions fs
          WHERE fs.member_id = m.id AND fs.created_at >= ?), 0) as weekly_xp,
        COALESCE((SELECT SUM(be.xp_penalty) FROM block_events be
          WHERE be.member_id = m.id AND be.created_at >= ?), 0) as weekly_penalties,
        COALESCE((SELECT SUM(fs.minutes) FROM focus_sessions fs
          WHERE fs.member_id = m.id AND date(fs.created_at) = date('now')), 0) as today_minutes
      FROM members m
      WHERE m.fellowship_id = ?
    `
    )
    .all(weekStart, weekStart, fellowshipId) as Array<
    Member & { weekly_xp: number; weekly_penalties: number; today_minutes: number }
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

  const markLabel = HABIT_MARKS[resolveHabitMarkId(habit.emoji)]?.label || "Habit";
  addFeedEvent(
    fellowshipId,
    "habit",
    member.name,
    `${member.name} checked in: ${markLabel} · ${habit.label} (+${xp} XP).`
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

export function addFocusProof(
  memberId: string,
  fellowshipId: string,
  sessionId: string | null,
  proofType: ProofType,
  privacyTier: ProofPrivacyTier,
  activeApp: string | null,
  imageBase64?: string
): FocusProof {
  const database = getDb();
  const id = nanoid();
  let thumbPath: string | null = null;
  if (imageBase64 && privacyTier !== "signal") {
    thumbPath = saveProofThumb(imageBase64);
  }
  database
    .prepare(
      `INSERT INTO focus_proofs (id, session_id, member_id, fellowship_id, proof_type, privacy_tier, active_app, thumb_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, sessionId, memberId, fellowshipId, proofType, privacyTier, activeApp, thumbPath);

  return database.prepare("SELECT * FROM focus_proofs WHERE id = ?").get(id) as FocusProof;
}

export function bumpSessionActivity(sessionId: string, memberId: string, score: number) {
  const database = getDb();
  database
    .prepare(
      `UPDATE focus_sessions SET activity_score = CASE
         WHEN activity_score > ? THEN activity_score ELSE ?
       END WHERE id = ? AND member_id = ?`
    )
    .run(score, score, sessionId, memberId);
}

export type TrustMember = {
  member_id: string;
  name: string;
  proof_count_7d: number;
  screen_count_7d: number;
  webcam_count_7d: number;
  activity_score_7d: number;
  last_app: string | null;
  last_proof_at: string | null;
  trust_score: number;
};

export function getTrustLeaderboard(fellowshipId: string): TrustMember[] {
  const database = getDb();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().replace("T", " ").slice(0, 19);
  const members = getMembers(fellowshipId);

  return members.map((m) => {
    const stats = database
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN proof_type = 'screen' THEN 1 ELSE 0 END) as screens,
          SUM(CASE WHEN proof_type = 'webcam' THEN 1 ELSE 0 END) as webcams
         FROM focus_proofs WHERE member_id = ? AND created_at >= ?`
      )
      .get(m.id, weekAgo) as { total: number; screens: number; webcams: number };

    const last = database
      .prepare(
        `SELECT active_app, created_at FROM focus_proofs
         WHERE member_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(m.id) as { active_app: string | null; created_at: string } | undefined;

    const activity = database
      .prepare(
        `SELECT COALESCE(SUM(activity_score), 0) as total
         FROM focus_sessions WHERE member_id = ? AND created_at >= ?`
      )
      .get(m.id, weekAgo) as { total: number };

    const proofCount = stats?.total ?? 0;
    const activityScore = activity?.total ?? 0;
    const activityBonus = Math.min(25, Math.floor(activityScore / 4000));
    const trustScore = Math.min(100, proofCount * 8 + (stats?.screens ?? 0) * 2 + activityBonus);

    return {
      member_id: m.id,
      name: m.name,
      proof_count_7d: proofCount,
      screen_count_7d: stats?.screens ?? 0,
      webcam_count_7d: stats?.webcams ?? 0,
      activity_score_7d: activityScore,
      last_app: last?.active_app ?? null,
      last_proof_at: last?.created_at ?? null,
      trust_score: trustScore,
    };
  }).sort((a, b) => b.trust_score - a.trust_score);
}

export function getProofById(proofId: string): FocusProof | undefined {
  return getDb().prepare("SELECT * FROM focus_proofs WHERE id = ?").get(proofId) as FocusProof | undefined;
}

// ── Screen time / app usage ────────────────────────────

export type AppUsage = {
  id: string;
  member_id: string;
  fellowship_id: string;
  date: string;
  work_seconds: number;
  distraction_seconds: number;
  personal_seconds: number;
  neutral_seconds: number;
  focus_score: number;
  updated_at: string;
};

export function recordAppUsage(
  memberId: string,
  fellowshipId: string,
  usage: {
    workSeconds: number;
    distractionSeconds: number;
    personalSeconds: number;
    neutralSeconds: number;
    focusScore: number;
  }
): AppUsage {
  const database = getDb();
  const date = new Date().toISOString().slice(0, 10);
  const existing = database
    .prepare("SELECT id FROM app_usage WHERE member_id = ? AND date = ?")
    .get(memberId, date) as { id: string } | undefined;

  if (existing) {
    database
      .prepare(
        `UPDATE app_usage SET work_seconds = ?, distraction_seconds = ?, personal_seconds = ?,
           neutral_seconds = ?, focus_score = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        usage.workSeconds,
        usage.distractionSeconds,
        usage.personalSeconds,
        usage.neutralSeconds,
        usage.focusScore,
        existing.id
      );
    return database.prepare("SELECT * FROM app_usage WHERE id = ?").get(existing.id) as AppUsage;
  }

  const id = nanoid();
  database
    .prepare(
      `INSERT INTO app_usage
         (id, member_id, fellowship_id, date, work_seconds, distraction_seconds, personal_seconds, neutral_seconds, focus_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      memberId,
      fellowshipId,
      date,
      usage.workSeconds,
      usage.distractionSeconds,
      usage.personalSeconds,
      usage.neutralSeconds,
      usage.focusScore
    );
  return database.prepare("SELECT * FROM app_usage WHERE id = ?").get(id) as AppUsage;
}

export function getMemberUsageToday(memberId: string): AppUsage | undefined {
  const date = new Date().toISOString().slice(0, 10);
  return getDb()
    .prepare("SELECT * FROM app_usage WHERE member_id = ? AND date = ?")
    .get(memberId, date) as AppUsage | undefined;
}

// ── Block list & focus prefs (the web control center) ──

export type BlocklistEntry = {
  id: string;
  member_id: string;
  site: string;
  category: string | null;
  created_at: string;
};

export type MemberPrefs = {
  member_id: string;
  focus_min: number;
  break_min: number;
  cycles: number;
  settings_json: string;
  updated_at: string;
};

function _normSite(site: string): string {
  return site
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .slice(0, 120);
}

export function getBlocklist(memberId: string): BlocklistEntry[] {
  return getDb()
    .prepare("SELECT * FROM member_blocklist WHERE member_id = ? ORDER BY created_at DESC")
    .all(memberId) as BlocklistEntry[];
}

export function addBlocklistSites(
  memberId: string,
  sites: string[],
  category: string | null = null
): BlocklistEntry[] {
  const database = getDb();
  const insert = database.prepare(
    `INSERT OR IGNORE INTO member_blocklist (id, member_id, site, category) VALUES (?, ?, ?, ?)`
  );
  const tx = database.transaction((rows: string[]) => {
    for (const raw of rows) {
      const site = _normSite(raw);
      if (site) insert.run(nanoid(), memberId, site, category);
    }
  });
  tx(sites);
  return getBlocklist(memberId);
}

export function removeBlocklistSite(memberId: string, site: string): BlocklistEntry[] {
  getDb()
    .prepare("DELETE FROM member_blocklist WHERE member_id = ? AND site = ?")
    .run(memberId, _normSite(site));
  return getBlocklist(memberId);
}

export function replaceBlocklist(memberId: string, sites: string[]): BlocklistEntry[] {
  const database = getDb();
  database.prepare("DELETE FROM member_blocklist WHERE member_id = ?").run(memberId);
  return addBlocklistSites(memberId, sites, "import");
}

export function getMemberPrefs(memberId: string): MemberPrefs {
  const database = getDb();
  let row = database
    .prepare("SELECT * FROM member_prefs WHERE member_id = ?")
    .get(memberId) as MemberPrefs | undefined;
  if (!row) {
    database.prepare("INSERT INTO member_prefs (member_id) VALUES (?)").run(memberId);
    row = database
      .prepare("SELECT * FROM member_prefs WHERE member_id = ?")
      .get(memberId) as MemberPrefs;
  }
  return row;
}

export function setMemberPrefs(
  memberId: string,
  prefs: { focus_min: number; break_min: number; cycles: number; settings_json?: string }
): MemberPrefs {
  const database = getDb();
  getMemberPrefs(memberId);
  if (prefs.settings_json !== undefined) {
    database
      .prepare(
        `UPDATE member_prefs SET focus_min = ?, break_min = ?, cycles = ?, settings_json = ?,
         updated_at = datetime('now') WHERE member_id = ?`
      )
      .run(
        Math.max(1, Math.min(180, prefs.focus_min)),
        Math.max(0, Math.min(60, prefs.break_min)),
        Math.max(1, Math.min(12, prefs.cycles)),
        prefs.settings_json,
        memberId
      );
  } else {
    database
      .prepare(
        `UPDATE member_prefs SET focus_min = ?, break_min = ?, cycles = ?, updated_at = datetime('now')
         WHERE member_id = ?`
      )
      .run(
        Math.max(1, Math.min(180, prefs.focus_min)),
        Math.max(0, Math.min(60, prefs.break_min)),
        Math.max(1, Math.min(12, prefs.cycles)),
        memberId
      );
  }
  return getMemberPrefs(memberId);
}

// Re-export helpers used by API — blocker settings live in settings_json

export function getBlockerSettings(memberId: string): BlockerSettings {
  const row = getMemberPrefs(memberId);
  let parsed: Partial<BlockerSettings> = {};
  try {
    parsed = JSON.parse(row.settings_json || "{}") as Partial<BlockerSettings>;
  } catch {
    parsed = {};
  }
  return mergeBlockerSettings({
    ...parsed,
    focus_min: row.focus_min || parsed.focus_min || DEFAULT_BLOCKER_SETTINGS.focus_min,
    break_min: row.break_min ?? parsed.break_min ?? DEFAULT_BLOCKER_SETTINGS.break_min,
    cycles: row.cycles || parsed.cycles || DEFAULT_BLOCKER_SETTINGS.cycles,
  });
}

export function setBlockerSettings(
  memberId: string,
  settings: BlockerSettings
): BlockerSettings {
  const merged = mergeBlockerSettings(settings);
  setMemberPrefs(memberId, {
    focus_min: merged.focus_min,
    break_min: merged.break_min,
    cycles: merged.cycles,
    settings_json: JSON.stringify(merged),
  });
  return getBlockerSettings(memberId);
}

export function upsertBlockerDevice(input: {
  memberId: string;
  kind: string;
  label: string;
  shieldOn?: boolean;
  meta?: string;
  deviceId?: string;
}): { id: string; kind: string; label: string; last_seen: string; shield_on: number } {
  const database = getDb();
  const id = input.deviceId || `${input.kind}-${nanoid(8)}`;
  const existing = database
    .prepare("SELECT id FROM blocker_devices WHERE id = ? AND member_id = ?")
    .get(id, input.memberId) as { id: string } | undefined;
  if (existing) {
    database
      .prepare(
        `UPDATE blocker_devices SET label = ?, last_seen = datetime('now'),
         shield_on = ?, meta = COALESCE(?, meta) WHERE id = ?`
      )
      .run(input.label, input.shieldOn ? 1 : 0, input.meta ?? null, id);
  } else {
    database
      .prepare(
        `INSERT INTO blocker_devices (id, member_id, kind, label, shield_on, meta)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.memberId, input.kind, input.label, input.shieldOn ? 1 : 0, input.meta ?? null);
  }
  return database.prepare("SELECT * FROM blocker_devices WHERE id = ?").get(id) as {
    id: string;
    kind: string;
    label: string;
    last_seen: string;
    shield_on: number;
  };
}

export function listBlockerDevices(memberId: string) {
  return getDb()
    .prepare(
      `SELECT id, kind, label, last_seen, shield_on FROM blocker_devices
       WHERE member_id = ? ORDER BY last_seen DESC LIMIT 20`
    )
    .all(memberId) as Array<{
    id: string;
    kind: string;
    label: string;
    last_seen: string;
    shield_on: number;
  }>;
}

export function revokeBlockerDevice(memberId: string, deviceId: string) {
  getDb()
    .prepare("DELETE FROM blocker_devices WHERE member_id = ? AND id = ?")
    .run(memberId, deviceId);
  return listBlockerDevices(memberId);
}

export function createPairCode(memberId: string, token: string): { code: string; expires_at: string } {
  const database = getDb();
  const code = nanoid(10);
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  database
    .prepare(`INSERT INTO pair_codes (code, member_id, token, expires_at) VALUES (?, ?, ?, ?)`)
    .run(code, memberId, token, expires);
  return { code, expires_at: expires };
}

export function consumePairCode(code: string): { token: string; member_id: string } | null {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM pair_codes WHERE code = ?`)
    .get(code) as
    | { code: string; member_id: string; token: string; expires_at: string }
    | undefined;
  if (!row) return null;
  database.prepare(`DELETE FROM pair_codes WHERE code = ?`).run(code);
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { token: row.token, member_id: row.member_id };
}

export function logBypassEvent(memberId: string, kind: string, detail?: string) {
  getDb()
    .prepare(`INSERT INTO bypass_events (id, member_id, kind, detail) VALUES (?, ?, ?, ?)`)
    .run(nanoid(), memberId, kind, detail ?? null);
}

// ── Weekly agenda, OKR & productivity ──────────────────

export type MemberGoals = {
  member_id: string;
  focus_hours_target: number;
  habit_rate_target: number;
  revenue_target_cents: number;
  revenue_current_cents: number;
  updated_at: string;
};

export function getMemberGoals(memberId: string): MemberGoals {
  const database = getDb();
  let row = database
    .prepare("SELECT * FROM member_goals WHERE member_id = ?")
    .get(memberId) as MemberGoals | undefined;
  if (!row) {
    database.prepare("INSERT INTO member_goals (member_id) VALUES (?)").run(memberId);
    row = database
      .prepare("SELECT * FROM member_goals WHERE member_id = ?")
      .get(memberId) as MemberGoals;
  }
  return row;
}

export function setMemberGoals(
  memberId: string,
  goals: Partial<{
    focus_hours_target: number;
    habit_rate_target: number;
    revenue_target_cents: number;
    revenue_current_cents: number;
  }>
): MemberGoals {
  const current = getMemberGoals(memberId);
  const next = {
    focus_hours_target: clampInt(goals.focus_hours_target ?? current.focus_hours_target, 1, 80),
    habit_rate_target: clampInt(goals.habit_rate_target ?? current.habit_rate_target, 10, 100),
    revenue_target_cents: clampInt(
      goals.revenue_target_cents ?? current.revenue_target_cents,
      0,
      100_000_00
    ),
    revenue_current_cents: clampInt(
      goals.revenue_current_cents ?? current.revenue_current_cents,
      0,
      100_000_00
    ),
  };
  getDb()
    .prepare(
      `UPDATE member_goals SET focus_hours_target = ?, habit_rate_target = ?,
         revenue_target_cents = ?, revenue_current_cents = ?, updated_at = datetime('now')
       WHERE member_id = ?`
    )
    .run(
      next.focus_hours_target,
      next.habit_rate_target,
      next.revenue_target_cents,
      next.revenue_current_cents,
      memberId
    );
  return getMemberGoals(memberId);
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(Number(n) || 0)));
}

/** Monday (local server time) of the current week, as YYYY-MM-DD. */
function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export type ProductivityDay = {
  date: string;
  weekday: string;
  focus_minutes: number;
  sessions: number;
  work_seconds: number;
  distraction_seconds: number;
  focus_score: number;
};

export type WeeklyProductivity = {
  week_start: string;
  days: ProductivityDay[];
  kpis: {
    focus_hours: number;
    focus_sessions: number;
    avg_focus_score: number;
    distraction_hours: number;
    streak: number;
    habit_rate: number;
  };
  okr: {
    focus_hours: { current: number; target: number };
    habit_rate: { current: number; target: number };
    revenue: { current_cents: number; target_cents: number };
  };
};

export function getWeeklyProductivity(memberId: string): WeeklyProductivity {
  const database = getDb();
  const weekStart = getWeekStartDate();
  syncAutoHabits(memberId, "");

  const sessionRows = database
    .prepare(
      `SELECT date(created_at) as d, COALESCE(SUM(minutes), 0) as minutes, COUNT(*) as sessions
       FROM focus_sessions
       WHERE member_id = ? AND completed = 1 AND date(created_at) >= ?
       GROUP BY d`
    )
    .all(memberId, weekStart) as Array<{ d: string; minutes: number; sessions: number }>;
  const byDaySessions = new Map(sessionRows.map((r) => [r.d, r]));

  const usageRows = database
    .prepare(
      `SELECT date, work_seconds, distraction_seconds, focus_score
       FROM app_usage WHERE member_id = ? AND date >= ?`
    )
    .all(memberId, weekStart) as Array<{
    date: string;
    work_seconds: number;
    distraction_seconds: number;
    focus_score: number;
  }>;
  const byDayUsage = new Map(usageRows.map((r) => [r.date, r]));

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const monday = new Date(`${weekStart}T00:00:00`);
  const today = new Date().toISOString().slice(0, 10);
  const days: ProductivityDay[] = [];
  let daysElapsed = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (iso <= today) daysElapsed = i + 1;
    const s = byDaySessions.get(iso);
    const u = byDayUsage.get(iso);
    days.push({
      date: iso,
      weekday: weekdays[i],
      focus_minutes: s?.minutes ?? 0,
      sessions: s?.sessions ?? 0,
      work_seconds: u?.work_seconds ?? 0,
      distraction_seconds: u?.distraction_seconds ?? 0,
      focus_score: u?.focus_score ?? 0,
    });
  }

  const focusMinutes = days.reduce((sum, d) => sum + d.focus_minutes, 0);
  const focusSessions = days.reduce((sum, d) => sum + d.sessions, 0);
  const distractionSeconds = days.reduce((sum, d) => sum + d.distraction_seconds, 0);
  const scored = days.filter((d) => d.focus_score > 0);
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, d) => sum + d.focus_score, 0) / scored.length)
    : 0;

  const activeHabits = getMemberHabits(memberId).length;
  const checkins = (
    database
      .prepare(
        `SELECT COUNT(*) as c FROM habit_checkins
         WHERE member_id = ? AND completed = 1 AND date >= ?`
      )
      .get(memberId, weekStart) as { c: number }
  ).c;
  const habitDenom = activeHabits * Math.max(1, daysElapsed);
  const habitRate = habitDenom > 0 ? Math.round((100 * checkins) / habitDenom) : 0;

  const member = database.prepare("SELECT streak FROM members WHERE id = ?").get(memberId) as
    | { streak: number }
    | undefined;
  const goals = getMemberGoals(memberId);

  return {
    week_start: weekStart,
    days,
    kpis: {
      focus_hours: Math.round((focusMinutes / 60) * 10) / 10,
      focus_sessions: focusSessions,
      avg_focus_score: avgScore,
      distraction_hours: Math.round((distractionSeconds / 3600) * 10) / 10,
      streak: member?.streak ?? 0,
      habit_rate: Math.min(100, habitRate),
    },
    okr: {
      focus_hours: {
        current: Math.round((focusMinutes / 60) * 10) / 10,
        target: goals.focus_hours_target,
      },
      habit_rate: { current: Math.min(100, habitRate), target: goals.habit_rate_target },
      revenue: {
        current_cents: goals.revenue_current_cents,
        target_cents: goals.revenue_target_cents,
      },
    },
  };
}

// ── Google identity + history suggestions ─────────────────

const DISTRACTOR_WEIGHT: Record<string, number> = {
  "youtube.com": 40,
  "x.com": 40,
  "twitter.com": 40,
  "reddit.com": 38,
  "instagram.com": 38,
  "tiktok.com": 42,
  "facebook.com": 35,
  "netflix.com": 40,
  "twitch.tv": 38,
  "linkedin.com": 20,
  "news.google.com": 25,
  "cnn.com": 22,
  "bbc.com": 22,
  "amazon.com": 18,
};

const WORK_DOMAINS = new Set([
  "github.com",
  "gitlab.com",
  "stackoverflow.com",
  "docs.google.com",
  "drive.google.com",
  "mail.google.com",
  "calendar.google.com",
  "notion.so",
  "linear.app",
  "vercel.com",
  "railway.app",
  "figma.com",
  "slack.com",
  "zoom.us",
  "meet.google.com",
]);

function suggestionScore(domain: string, visits: number): number {
  if (WORK_DOMAINS.has(domain)) return 0;
  const base = DISTRACTOR_WEIGHT[domain] ?? (visits >= 20 ? 15 : visits >= 8 ? 8 : 0);
  if (base === 0) return 0;
  return base + Math.min(30, Math.floor(Math.log2(Math.max(1, visits)) * 4));
}

export function ensureGoogleUser(input: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  linkMemberId?: string;
}): GoogleUser & { plaintextToken: string | null } {
  const database = getDb();
  const existing = database
    .prepare("SELECT * FROM google_users WHERE google_id = ?")
    .get(input.googleId) as GoogleUser | undefined;

  if (existing) {
    if (input.linkMemberId && input.linkMemberId !== existing.member_id) {
      const linked = database
        .prepare("SELECT token, token_enc FROM members WHERE id = ?")
        .get(input.linkMemberId) as { token: string; token_enc: string | null } | undefined;
      database
        .prepare(
          `UPDATE google_users SET email = ?, name = ?, avatar_url = ?,
           member_id = ?, token = COALESCE(?, token), token_enc = COALESCE(?, token_enc) WHERE id = ?`
        )
        .run(
          input.email,
          input.name,
          input.avatarUrl,
          input.linkMemberId,
          linked?.token ?? null,
          linked?.token_enc ?? null,
          existing.id
        );
    } else {
      database
        .prepare(`UPDATE google_users SET email = ?, name = ?, avatar_url = ? WHERE id = ?`)
        .run(input.email, input.name, input.avatarUrl, existing.id);
    }
    const user = database.prepare("SELECT * FROM google_users WHERE id = ?").get(existing.id) as GoogleUser;
    const plaintext =
      (user.member_id ? revealMemberToken(user.member_id) : null) ||
      (user.token_enc ? openToken(user.token_enc) : null) ||
      (looksLikeLegacyPlaintext(user.token) ? user.token : null);
    return { ...user, plaintextToken: plaintext };
  }

  let memberId = input.linkMemberId ?? null;
  let tokenHash: string;
  let tokenEnc: string;
  let plaintext: string;

  if (memberId) {
    const member = database
      .prepare("SELECT token, token_enc FROM members WHERE id = ?")
      .get(memberId) as { token: string; token_enc: string | null } | undefined;
    if (member) {
      tokenHash = member.token;
      plaintext = member.token_enc
        ? openToken(member.token_enc) || mintToken()
        : looksLikeLegacyPlaintext(member.token)
          ? member.token
          : mintToken();
      tokenEnc = member.token_enc || sealToken(plaintext);
      if (!member.token_enc || looksLikeLegacyPlaintext(member.token)) {
        tokenHash = hashToken(plaintext);
        tokenEnc = sealToken(plaintext);
        database
          .prepare("UPDATE members SET token = ?, token_enc = ? WHERE id = ?")
          .run(tokenHash, tokenEnc, memberId);
      }
    } else {
      plaintext = mintToken();
      tokenHash = hashToken(plaintext);
      tokenEnc = sealToken(plaintext);
    }
  } else {
    // Personal solo fellowship so blocklist/prefs APIs accept this token
    const fellowship = createFellowship(`Solo · ${input.name.slice(0, 24)}`);
    const joined = joinFellowship(fellowship.id, input.name);
    memberId = joined.member.id;
    plaintext = joined.plaintextToken;
    tokenHash = joined.member.token;
    tokenEnc = joined.member.token_enc || sealToken(plaintext);
  }

  const id = nanoid();
  database
    .prepare(
      `INSERT INTO google_users (id, google_id, email, name, avatar_url, token, token_enc, member_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.googleId, input.email, input.name, input.avatarUrl, tokenHash, tokenEnc, memberId);
  const user = database.prepare("SELECT * FROM google_users WHERE id = ?").get(id) as GoogleUser;
  return { ...user, plaintextToken: plaintext };
}

export function getGoogleUserByToken(token: string): GoogleUser | undefined {
  if (!token) return undefined;
  const database = getDb();
  const hashed = hashToken(token);
  const byHash = database.prepare("SELECT * FROM google_users WHERE token = ?").get(hashed) as
    | GoogleUser
    | undefined;
  if (byHash) return byHash;
  const legacy = database.prepare("SELECT * FROM google_users WHERE token = ?").get(token) as
    | GoogleUser
    | undefined;
  if (legacy && looksLikeLegacyPlaintext(legacy.token)) {
    const tokenHash = hashToken(token);
    const tokenEnc = sealToken(token);
    database
      .prepare("UPDATE google_users SET token = ?, token_enc = COALESCE(token_enc, ?) WHERE id = ?")
      .run(tokenHash, tokenEnc, legacy.id);
    if (legacy.member_id) {
      database
        .prepare("UPDATE members SET token = ?, token_enc = COALESCE(token_enc, ?) WHERE id = ?")
        .run(tokenHash, tokenEnc, legacy.member_id);
    }
    return database.prepare("SELECT * FROM google_users WHERE id = ?").get(legacy.id) as GoogleUser;
  }
  return undefined;
}

export function getGoogleUserByGoogleId(googleId: string): GoogleUser | undefined {
  return getDb().prepare("SELECT * FROM google_users WHERE google_id = ?").get(googleId) as
    | GoogleUser
    | undefined;
}

export function saveHistorySuggestions(
  ownerId: string,
  domains: Array<{ domain: string; visits: number; lastVisit?: number }>
): HistorySuggestion[] {
  const database = getDb();
  const upsert = database.prepare(
    `INSERT INTO history_suggestions (owner_id, domain, visits, score, last_visit, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(owner_id, domain) DO UPDATE SET
       visits = excluded.visits,
       score = excluded.score,
       last_visit = excluded.last_visit,
       updated_at = datetime('now')`
  );

  const tx = database.transaction(() => {
    for (const d of domains.slice(0, 80)) {
      const domain = d.domain
        .trim()
        .toLowerCase()
        .replace(/^www\./, "");
      if (!domain || domain.includes(" ")) continue;
      const score = suggestionScore(domain, d.visits || 0);
      if (score <= 0) continue;
      upsert.run(ownerId, domain, d.visits || 0, score, d.lastVisit ?? null);
    }
  });
  tx();
  return getHistorySuggestions(ownerId);
}

export function getHistorySuggestions(ownerId: string): HistorySuggestion[] {
  return getDb()
    .prepare(
      `SELECT * FROM history_suggestions WHERE owner_id = ?
       ORDER BY score DESC, visits DESC LIMIT 40`
    )
    .all(ownerId) as HistorySuggestion[];
}
