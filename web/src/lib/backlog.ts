/**
 * Product backlog feature layer (E1–E12) — sits on top of db.ts.
 */
import { nanoid } from "nanoid";
import {
  getDb,
  getMemberPrefs,
  getMemberRecords,
  getMemberWorkDays,
  getWeeklyProductivity,
  type MemberRecords,
  type WeeklyProductivity,
} from "./db";
import { computeFocusScore, scoreBreakdown, SCORE_FORMULA_BLURB } from "./focusScore";
import { isWorkDay, STREAK_MILESTONES, addDays, isoDate } from "./streaks";

// ── E1 Session Recap ──────────────────────────────────────

export type SessionRecap = {
  session_id: string;
  minutes: number;
  planned_minutes: number | null;
  focus_score: number;
  blocks_during_session: number;
  xp_earned: number;
  streak: number;
  value_line: string;
  intention: string | null;
  reflection: string | null;
  goal_done: number | null;
  focusing_now: number;
  clean_session: boolean;
};

export function countFocusingNow(fellowshipId?: string | null): number {
  const database = getDb();
  const since = new Date(Date.now() - 3 * 3600000).toISOString().replace("T", " ").slice(0, 19);
  if (fellowshipId) {
    return (
      database
        .prepare(
          `SELECT COUNT(*) as c FROM focus_sessions
           WHERE completed = 0 AND fellowship_id = ? AND created_at >= ?`
        )
        .get(fellowshipId, since) as { c: number }
    ).c;
  }
  return (
    database
      .prepare(
        `SELECT COUNT(*) as c FROM focus_sessions WHERE completed = 0 AND created_at >= ?`
      )
      .get(since) as { c: number }
  ).c;
}

export function getSessionRecap(memberId: string, sessionId: string): SessionRecap | null {
  const database = getDb();
  const session = database
    .prepare("SELECT * FROM focus_sessions WHERE id = ? AND member_id = ?")
    .get(sessionId, memberId) as
    | {
        id: string;
        minutes: number;
        xp_earned: number;
        activity_score: number;
        created_at: string;
        intention: string | null;
        reflection: string | null;
        goal_done: number | null;
        planned_minutes: number | null;
        fellowship_id: string;
      }
    | undefined;
  if (!session) return null;

  const blocks = (
    database
      .prepare(
        `SELECT COUNT(*) as c FROM block_events
         WHERE member_id = ? AND created_at >= ?`
      )
      .get(memberId, session.created_at) as { c: number }
  ).c;

  const today = isoDate();
  const usage = database
    .prepare("SELECT * FROM app_usage WHERE member_id = ? AND date = ?")
    .get(memberId, today) as
    | {
        work_seconds: number;
        distraction_seconds: number;
        personal_seconds: number;
        neutral_seconds: number;
        focus_score: number;
      }
    | undefined;

  const member = database
    .prepare("SELECT streak FROM members WHERE id = ?")
    .get(memberId) as { streak: number };

  const focusScore =
    usage != null
      ? computeFocusScore({
          focus_seconds: session.minutes * 60,
          work_seconds: usage.work_seconds,
          distraction_seconds: usage.distraction_seconds,
          personal_seconds: usage.personal_seconds,
          neutral_seconds: usage.neutral_seconds,
        })
      : session.activity_score || 0;

  const clean = blocks === 0;
  const value_line = clean
    ? "0 distractions — clean session"
    : `Shield held ${blocks} time${blocks === 1 ? "" : "s"}`;

  return {
    session_id: session.id,
    minutes: session.minutes,
    planned_minutes: session.planned_minutes,
    focus_score: focusScore,
    blocks_during_session: blocks,
    xp_earned: session.xp_earned,
    streak: member?.streak ?? 0,
    value_line,
    intention: session.intention,
    reflection: session.reflection,
    goal_done: session.goal_done,
    focusing_now: countFocusingNow(session.fellowship_id),
    clean_session: clean,
  };
}

export function updateSessionNotes(
  memberId: string,
  sessionId: string,
  notes: { intention?: string; reflection?: string; goalDone?: boolean | null }
): boolean {
  const database = getDb();
  const row = database
    .prepare("SELECT id FROM focus_sessions WHERE id = ? AND member_id = ?")
    .get(sessionId, memberId);
  if (!row) return false;
  database
    .prepare(
      `UPDATE focus_sessions SET
         intention = COALESCE(?, intention),
         reflection = COALESCE(?, reflection),
         goal_done = COALESCE(?, goal_done)
       WHERE id = ? AND member_id = ?`
    )
    .run(
      notes.intention ?? null,
      notes.reflection ?? null,
      notes.goalDone === undefined || notes.goalDone === null
        ? null
        : notes.goalDone
          ? 1
          : 0,
      sessionId,
      memberId
    );
  return true;
}

// ── E2 Streak status ──────────────────────────────────────

export function getStreakStatus(memberId: string) {
  const database = getDb();
  const member = database
    .prepare("SELECT streak, last_quest_date FROM members WHERE id = ?")
    .get(memberId) as { streak: number; last_quest_date: string | null };
  const workDays = getMemberWorkDays(memberId);
  const records = getMemberRecords(memberId);
  const today = isoDate();
  const now = new Date();
  const hoursLeft = 23 - now.getHours();
  const hadToday = member.last_quest_date === today;
  const in_danger =
    isWorkDay(today, workDays) && !hadToday && hoursLeft < 3 && (member.streak || 0) > 0;

  let milestone_next: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if ((member.streak || 0) < m) {
      milestone_next = m;
      break;
    }
  }

  return {
    streak: member.streak || 0,
    work_days: workDays,
    last_quest_date: member.last_quest_date,
    records,
    in_danger,
    milestone_next,
  };
}

// ── E3 Focus Score hero ───────────────────────────────────

export function getFocusScoreHero(memberId: string) {
  const database = getDb();
  const today = isoDate();
  const yesterday = addDays(today, -1);

  const loadDay = (date: string) => {
    const usage = database
      .prepare("SELECT * FROM app_usage WHERE member_id = ? AND date = ?")
      .get(memberId, date) as
      | {
          work_seconds: number;
          distraction_seconds: number;
          personal_seconds: number;
          neutral_seconds: number;
          focus_score: number;
          hourly_json?: string;
          apps_json?: string;
        }
      | undefined;
    const focusMin = (
      database
        .prepare(
          `SELECT COALESCE(SUM(minutes), 0) as m FROM focus_sessions
           WHERE member_id = ? AND completed = 1 AND date(created_at) = ?`
        )
        .get(memberId, date) as { m: number }
    ).m;
    const seconds = {
      focus_seconds: focusMin * 60,
      work_seconds: usage?.work_seconds ?? 0,
      distraction_seconds: usage?.distraction_seconds ?? 0,
      personal_seconds: usage?.personal_seconds ?? 0,
      neutral_seconds: usage?.neutral_seconds ?? 0,
    };
    const score =
      usage && (usage.work_seconds + usage.distraction_seconds + focusMin) > 0
        ? computeFocusScore(seconds)
        : usage?.focus_score ?? 0;
    let apps: Array<{ name: string; seconds: number; category?: string }> = [];
    let hourly: Record<string, number> = {};
    try {
      apps = JSON.parse(usage?.apps_json || "[]");
    } catch {
      apps = [];
    }
    try {
      hourly = JSON.parse(usage?.hourly_json || "{}");
    } catch {
      hourly = {};
    }
    return { score, seconds, apps, hourly, breakdown: scoreBreakdown(seconds) };
  };

  const t = loadDay(today);
  const y = loadDay(yesterday);
  const bestHourEntry = Object.entries(t.hourly).sort((a, b) => b[1] - a[1])[0];
  const topApps = [...t.apps].sort((a, b) => b.seconds - a.seconds).slice(0, 8);

  return {
    today: t.score,
    yesterday: y.score,
    delta: t.score - y.score,
    breakdown: t.breakdown,
    top_apps: topApps,
    best_hour: bestHourEntry ? Number(bestHourEntry[0]) : null,
    formula: SCORE_FORMULA_BLURB,
  };
}

// ── E4 Weekly digest ──────────────────────────────────────

export function getWeeklyDigest(memberId: string) {
  const thisWeek = getWeeklyProductivity(memberId);
  const database = getDb();
  const prevStart = addDays(thisWeek.week_start, -7);
  const prevEnd = addDays(thisWeek.week_start, -1);

  const prevMins = (
    database
      .prepare(
        `SELECT COALESCE(SUM(minutes), 0) as m FROM focus_sessions
         WHERE member_id = ? AND completed = 1
           AND date(created_at) >= ? AND date(created_at) <= ?`
      )
      .get(memberId, prevStart, prevEnd) as { m: number }
  ).m;

  const topBlocks = database
    .prepare(
      `SELECT site, COUNT(*) as c FROM block_events
       WHERE member_id = ? AND date(created_at) >= ?
       GROUP BY site ORDER BY c DESC LIMIT 5`
    )
    .all(memberId, thisWeek.week_start) as Array<{ site: string; c: number }>;

  const bestDay = [...thisWeek.days].sort((a, b) => b.focus_minutes - a.focus_minutes)[0];
  const insights: string[] = [];
  if (bestDay && bestDay.focus_minutes > 0) {
    insights.push(`Best day: ${bestDay.weekday} (${Math.round(bestDay.focus_minutes / 60 * 10) / 10}h)`);
  }
  const hoursDelta =
    Math.round((thisWeek.kpis.focus_hours - prevMins / 60) * 10) / 10;
  if (prevMins > 0) {
    insights.push(
      hoursDelta >= 0
        ? `+${hoursDelta}h vs last week`
        : `${hoursDelta}h vs last week — tomorrow you can climb back`
    );
  }
  if (thisWeek.kpis.avg_focus_score >= 70) {
    insights.push("Strong focus pulse this week — keep the rhythm.");
  } else if (thisWeek.kpis.avg_focus_score > 0) {
    insights.push("Score has room to grow — check what's eating your time.");
  }
  if (topBlocks[0]) {
    insights.push(`Top temptation: ${topBlocks[0].site} (${topBlocks[0].c}×)`);
  }

  return {
    ...thisWeek,
    previous_focus_hours: Math.round((prevMins / 60) * 10) / 10,
    hours_delta: hoursDelta,
    insights,
    top_temptations: topBlocks,
  };
}

// ── E5 Billable ───────────────────────────────────────────

export type Client = {
  id: string;
  member_id: string;
  name: string;
  hourly_rate_cents: number;
  currency: string;
  color: string | null;
  active: number;
  created_at: string;
};

export type Project = {
  id: string;
  member_id: string;
  client_id: string | null;
  name: string;
  active: number;
  created_at: string;
};

export function listClients(memberId: string): Client[] {
  return getDb()
    .prepare("SELECT * FROM clients WHERE member_id = ? AND active = 1 ORDER BY name")
    .all(memberId) as Client[];
}

export function createClient(
  memberId: string,
  input: { name: string; hourly_rate_cents?: number; currency?: string; color?: string }
): Client {
  const id = nanoid();
  getDb()
    .prepare(
      `INSERT INTO clients (id, member_id, name, hourly_rate_cents, currency, color)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      memberId,
      input.name.trim().slice(0, 80),
      Math.max(0, input.hourly_rate_cents ?? 0),
      input.currency || "EUR",
      input.color || null
    );
  return getDb().prepare("SELECT * FROM clients WHERE id = ?").get(id) as Client;
}

export function updateClient(
  memberId: string,
  clientId: string,
  patch: Partial<{ name: string; hourly_rate_cents: number; currency: string; color: string; active: number }>
): Client | null {
  const database = getDb();
  const cur = database
    .prepare("SELECT * FROM clients WHERE id = ? AND member_id = ?")
    .get(clientId, memberId) as Client | undefined;
  if (!cur) return null;
  database
    .prepare(
      `UPDATE clients SET name = ?, hourly_rate_cents = ?, currency = ?, color = ?, active = ?
       WHERE id = ? AND member_id = ?`
    )
    .run(
      patch.name ?? cur.name,
      patch.hourly_rate_cents ?? cur.hourly_rate_cents,
      patch.currency ?? cur.currency,
      patch.color ?? cur.color,
      patch.active ?? cur.active,
      clientId,
      memberId
    );
  return database.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as Client;
}

export function listProjects(memberId: string, clientId?: string): Project[] {
  if (clientId) {
    return getDb()
      .prepare(
        "SELECT * FROM projects WHERE member_id = ? AND client_id = ? AND active = 1 ORDER BY name"
      )
      .all(memberId, clientId) as Project[];
  }
  return getDb()
    .prepare("SELECT * FROM projects WHERE member_id = ? AND active = 1 ORDER BY name")
    .all(memberId) as Project[];
}

export function createProject(
  memberId: string,
  input: { name: string; client_id?: string | null }
): Project {
  const id = nanoid();
  getDb()
    .prepare(
      `INSERT INTO projects (id, member_id, client_id, name) VALUES (?, ?, ?, ?)`
    )
    .run(id, memberId, input.client_id || null, input.name.trim().slice(0, 80));
  return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project;
}

export function listClientRules(memberId: string) {
  return getDb()
    .prepare("SELECT * FROM client_rules WHERE member_id = ? ORDER BY created_at DESC")
    .all(memberId) as Array<{
    id: string;
    member_id: string;
    client_id: string;
    match_type: string;
    pattern: string;
  }>;
}

export function upsertClientRule(
  memberId: string,
  input: { client_id: string; match_type: string; pattern: string; id?: string }
) {
  const id = input.id || nanoid();
  const database = getDb();
  const existing = input.id
    ? database.prepare("SELECT id FROM client_rules WHERE id = ? AND member_id = ?").get(id, memberId)
    : null;
  if (existing) {
    database
      .prepare(
        `UPDATE client_rules SET client_id = ?, match_type = ?, pattern = ? WHERE id = ?`
      )
      .run(input.client_id, input.match_type, input.pattern.toLowerCase(), id);
  } else {
    database
      .prepare(
        `INSERT INTO client_rules (id, member_id, client_id, match_type, pattern) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, memberId, input.client_id, input.match_type, input.pattern.toLowerCase());
  }
  return database.prepare("SELECT * FROM client_rules WHERE id = ?").get(id);
}

export function suggestClientForApp(memberId: string, haystack: string): string | null {
  const needle = haystack.toLowerCase();
  const rules = listClientRules(memberId);
  for (const r of rules) {
    if (needle.includes(r.pattern)) return r.client_id;
  }
  return null;
}

export function billableSummary(memberId: string, from: string, to: string) {
  const database = getDb();
  const clients = listClients(memberId);
  const byClient = new Map<string, { minutes: number; rate: number; name: string; currency: string }>();
  for (const c of clients) {
    byClient.set(c.id, {
      minutes: 0,
      rate: c.hourly_rate_cents,
      name: c.name,
      currency: c.currency,
    });
  }

  const sessions = database
    .prepare(
      `SELECT client_id, COALESCE(SUM(minutes), 0) as m FROM focus_sessions
       WHERE member_id = ? AND completed = 1 AND client_id IS NOT NULL
         AND date(created_at) >= ? AND date(created_at) <= ?
       GROUP BY client_id`
    )
    .all(memberId, from, to) as Array<{ client_id: string; m: number }>;

  for (const s of sessions) {
    const row = byClient.get(s.client_id);
    if (row) row.minutes += s.m;
  }

  const offline = database
    .prepare(
      `SELECT client_id, COALESCE(SUM(minutes), 0) as m FROM offline_time
       WHERE member_id = ? AND client_id IS NOT NULL AND date >= ? AND date <= ?
       GROUP BY client_id`
    )
    .all(memberId, from, to) as Array<{ client_id: string; m: number }>;
  for (const o of offline) {
    const row = byClient.get(o.client_id);
    if (row) row.minutes += o.m;
  }

  const rows = [...byClient.entries()]
    .map(([id, v]) => ({
      client_id: id,
      name: v.name,
      minutes: v.minutes,
      hours: Math.round((v.minutes / 60) * 100) / 100,
      rate_cents: v.rate,
      billable_cents: Math.round((v.minutes / 60) * v.rate),
      currency: v.currency,
    }))
    .filter((r) => r.minutes > 0);

  const total_cents = rows.reduce((a, r) => a + r.billable_cents, 0);
  return { from, to, rows, total_cents };
}

export function exportTimesheetCsv(memberId: string, from: string, to: string, clientId?: string) {
  const database = getDb();
  let sql = `SELECT date(created_at) as d, minutes, client_id, project_id, intention, activity
             FROM focus_sessions
             WHERE member_id = ? AND completed = 1 AND date(created_at) >= ? AND date(created_at) <= ?`;
  const params: string[] = [memberId, from, to];
  if (clientId) {
    sql += ` AND client_id = ?`;
    params.push(clientId);
  }
  sql += ` ORDER BY created_at`;
  const rows = database.prepare(sql).all(...params) as Array<{
    d: string;
    minutes: number;
    client_id: string | null;
    project_id: string | null;
    intention: string | null;
    activity: string;
  }>;
  const clients = new Map(listClients(memberId).map((c) => [c.id, c]));
  const lines = ["date,minutes,hours,client,rate_cents,amount_cents,note"];
  for (const r of rows) {
    const c = r.client_id ? clients.get(r.client_id) : undefined;
    const hours = r.minutes / 60;
    const amount = c ? Math.round(hours * c.hourly_rate_cents) : 0;
    const note = (r.intention || r.activity || "").replace(/"/g, "'");
    lines.push(
      `${r.d},${r.minutes},${hours.toFixed(2)},"${c?.name || ""}",${c?.hourly_rate_cents || 0},${amount},"${note}"`
    );
  }
  return lines.join("\n");
}

export function addOfflineTime(
  memberId: string,
  input: { date: string; minutes: number; label?: string; client_id?: string; project_id?: string }
) {
  const id = nanoid();
  getDb()
    .prepare(
      `INSERT INTO offline_time (id, member_id, client_id, project_id, date, minutes, label)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      memberId,
      input.client_id || null,
      input.project_id || null,
      input.date,
      Math.max(1, Math.round(input.minutes)),
      (input.label || "").slice(0, 120)
    );
  return getDb().prepare("SELECT * FROM offline_time WHERE id = ?").get(id);
}

// ── E6 Rituals ────────────────────────────────────────────

export function saveRitual(
  memberId: string,
  date: string,
  kind: "morning" | "shutdown",
  payload: Record<string, unknown>
) {
  const database = getDb();
  const existing = database
    .prepare("SELECT id FROM daily_rituals WHERE member_id = ? AND date = ? AND kind = ?")
    .get(memberId, date, kind) as { id: string } | undefined;
  if (existing) {
    database
      .prepare(`UPDATE daily_rituals SET payload_json = ? WHERE id = ?`)
      .run(JSON.stringify(payload), existing.id);
    return database.prepare("SELECT * FROM daily_rituals WHERE id = ?").get(existing.id);
  }
  const id = nanoid();
  database
    .prepare(
      `INSERT INTO daily_rituals (id, member_id, date, kind, payload_json) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, memberId, date, kind, JSON.stringify(payload));
  return database.prepare("SELECT * FROM daily_rituals WHERE id = ?").get(id);
}

export function getRitual(memberId: string, date: string, kind?: string) {
  if (kind) {
    return getDb()
      .prepare("SELECT * FROM daily_rituals WHERE member_id = ? AND date = ? AND kind = ?")
      .get(memberId, date, kind);
  }
  return getDb()
    .prepare("SELECT * FROM daily_rituals WHERE member_id = ? AND date = ?")
    .all(memberId, date);
}

export function getDailyFocusTarget(memberId: string): number {
  try {
    const prefs = getMemberPrefs(memberId);
    const parsed = JSON.parse(prefs.settings_json || "{}") as { daily_focus_target_min?: number };
    if (parsed.daily_focus_target_min) return parsed.daily_focus_target_min;
  } catch {
    /* ignore */
  }
  const ritual = getRitual(memberId, isoDate(), "morning") as
    | { payload_json: string }
    | undefined;
  if (ritual) {
    try {
      const p = JSON.parse(ritual.payload_json) as { focus_target_min?: number };
      if (p.focus_target_min) return p.focus_target_min;
    } catch {
      /* ignore */
    }
  }
  return 180;
}

// ── E7 Journal / highlights ───────────────────────────────

export function listSessionJournal(
  memberId: string,
  opts?: { notesOnly?: boolean; clientId?: string; limit?: number }
) {
  const limit = Math.min(200, opts?.limit ?? 50);
  let sql = `SELECT id, minutes, xp_earned, created_at, intention, reflection, goal_done, client_id, project_id
             FROM focus_sessions WHERE member_id = ? AND completed = 1`;
  const params: (string | number)[] = [memberId];
  if (opts?.notesOnly) {
    sql += ` AND (intention IS NOT NULL OR reflection IS NOT NULL)`;
  }
  if (opts?.clientId) {
    sql += ` AND client_id = ?`;
    params.push(opts.clientId);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  return getDb().prepare(sql).all(...params);
}

export function addDailyHighlight(memberId: string, text: string, date = isoDate()) {
  const id = nanoid();
  getDb()
    .prepare(`INSERT INTO daily_highlights (id, member_id, date, text) VALUES (?, ?, ?, ?)`)
    .run(id, memberId, date, text.trim().slice(0, 280));
  return getDb().prepare("SELECT * FROM daily_highlights WHERE id = ?").get(id);
}

export function listDailyHighlights(memberId: string, limit = 40) {
  return getDb()
    .prepare(
      `SELECT * FROM daily_highlights WHERE member_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(memberId, limit);
}

// ── E8 Share ──────────────────────────────────────────────

export function buildSharePayload(memberId: string, sessionId: string) {
  const recap = getSessionRecap(memberId, sessionId);
  if (!recap) return null;
  return {
    title: `${recap.minutes} min focus`,
    streak: recap.streak,
    blocks: recap.blocks_during_session,
    score: recap.focus_score,
    value_line: recap.value_line,
    watermark: "Fellowship Focus",
  };
}

// ── E11 Temptations ───────────────────────────────────────

export function getTemptationStats(memberId: string, days = 7) {
  const database = getDb();
  const since = addDays(isoDate(), -days);
  const top = database
    .prepare(
      `SELECT site, COUNT(*) as c FROM block_events
       WHERE member_id = ? AND date(created_at) >= ?
       GROUP BY site ORDER BY c DESC LIMIT 10`
    )
    .all(memberId, since) as Array<{ site: string; c: number }>;

  const byHourRows = database
    .prepare(
      `SELECT CAST(strftime('%H', created_at) AS INTEGER) as h, COUNT(*) as c
       FROM block_events WHERE member_id = ? AND date(created_at) >= ?
       GROUP BY h`
    )
    .all(memberId, since) as Array<{ h: number; c: number }>;
  const heatmap = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: byHourRows.find((r) => r.h === h)?.c ?? 0,
  }));

  return { days, top, heatmap };
}

// ── E12 Tasks ─────────────────────────────────────────────

export type Task = {
  id: string;
  member_id: string;
  parent_id: string | null;
  project_id: string | null;
  client_id: string | null;
  title: string;
  completed: number;
  estimate_minutes: number;
  time_spent_seconds: number;
  due_date: string | null;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function listTasks(memberId: string): Task[] {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE member_id = ? ORDER BY completed ASC, priority DESC, created_at DESC")
    .all(memberId) as Task[];
}

export function createTask(
  memberId: string,
  input: {
    title: string;
    parent_id?: string | null;
    project_id?: string | null;
    client_id?: string | null;
    estimate_minutes?: number;
    due_date?: string | null;
    priority?: number;
    notes?: string;
  }
): Task {
  const id = nanoid(10);
  getDb()
    .prepare(
      `INSERT INTO tasks
         (id, member_id, parent_id, project_id, client_id, title, estimate_minutes, due_date, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      memberId,
      input.parent_id || null,
      input.project_id || null,
      input.client_id || null,
      input.title.trim().slice(0, 200),
      input.estimate_minutes ?? 0,
      input.due_date || null,
      input.priority ?? 0,
      input.notes || null
    );
  return getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task;
}

export function updateTask(
  memberId: string,
  taskId: string,
  patch: Partial<{
    title: string;
    completed: boolean;
    estimate_minutes: number;
    time_spent_seconds: number;
    due_date: string | null;
    priority: number;
    notes: string | null;
    parent_id: string | null;
    project_id: string | null;
    client_id: string | null;
  }>
): Task | null {
  const database = getDb();
  const cur = database
    .prepare("SELECT * FROM tasks WHERE id = ? AND member_id = ?")
    .get(taskId, memberId) as Task | undefined;
  if (!cur) return null;
  database
    .prepare(
      `UPDATE tasks SET title = ?, completed = ?, estimate_minutes = ?, time_spent_seconds = ?,
         due_date = ?, priority = ?, notes = ?, parent_id = ?, project_id = ?, client_id = ?,
         updated_at = datetime('now')
       WHERE id = ? AND member_id = ?`
    )
    .run(
      patch.title ?? cur.title,
      patch.completed === undefined ? cur.completed : patch.completed ? 1 : 0,
      patch.estimate_minutes ?? cur.estimate_minutes,
      patch.time_spent_seconds ?? cur.time_spent_seconds,
      patch.due_date !== undefined ? patch.due_date : cur.due_date,
      patch.priority ?? cur.priority,
      patch.notes !== undefined ? patch.notes : cur.notes,
      patch.parent_id !== undefined ? patch.parent_id : cur.parent_id,
      patch.project_id !== undefined ? patch.project_id : cur.project_id,
      patch.client_id !== undefined ? patch.client_id : cur.client_id,
      taskId,
      memberId
    );
  return database.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Task;
}

export function deleteTask(memberId: string, taskId: string): boolean {
  const database = getDb();
  const exists = database
    .prepare("SELECT id FROM tasks WHERE id = ? AND member_id = ?")
    .get(taskId, memberId);
  if (!exists) return false;
  const ids = new Set<string>([taskId]);
  let changed = true;
  while (changed) {
    changed = false;
    const children = database
      .prepare("SELECT id, parent_id FROM tasks WHERE member_id = ?")
      .all(memberId) as Array<{ id: string; parent_id: string | null }>;
    for (const c of children) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        changed = true;
      }
    }
  }
  const del = database.prepare("DELETE FROM tasks WHERE id = ? AND member_id = ?");
  for (const id of ids) del.run(id, memberId);
  return true;
}

export type { MemberRecords, WeeklyProductivity };
