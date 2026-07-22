import type { WeeklyStats, WeeklyStatsDay } from "@/lib/desktop";

const OKR_KEY = "ff-solo-okr";
const SESSIONS_KEY = "ff-solo-sessions"; // [{ date: "YYYY-MM-DD", minutes: number }]

export type SoloOkr = {
  focus_hours_target: number;
  focus_score_target: number;
  revenue_target_eur: number;
  revenue_current_eur: number;
};

const DEFAULT_OKR: SoloOkr = {
  focus_hours_target: 20,
  focus_score_target: 70,
  revenue_target_eur: 3000,
  revenue_current_eur: 0,
};

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function league(hours: number): WeeklyStats["league"] {
  const tiers = [
    { name: "Mordor", at: 20 },
    { name: "Gondor", at: 10 },
    { name: "Rohan", at: 5 },
    { name: "Shire", at: 0 },
  ];
  let name = "Shire";
  for (const t of tiers) {
    if (hours >= t.at) {
      name = t.name;
      break;
    }
  }
  let next: { name: string; at: number } | null = null;
  for (const t of [...tiers].reverse()) {
    if (t.at > hours) {
      next = { name: t.name, at: t.at };
      break;
    }
  }
  return { name, hours, next };
}

export function loadSoloOkr(): SoloOkr {
  if (typeof window === "undefined") return { ...DEFAULT_OKR };
  try {
    const raw = localStorage.getItem(OKR_KEY);
    if (!raw) return { ...DEFAULT_OKR };
    return { ...DEFAULT_OKR, ...(JSON.parse(raw) as Partial<SoloOkr>) };
  } catch {
    return { ...DEFAULT_OKR };
  }
}

export function saveSoloOkr(patch: Partial<SoloOkr>): SoloOkr {
  const next = { ...loadSoloOkr(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(OKR_KEY, JSON.stringify(next));
  }
  return next;
}

export function logSoloSession(minutes: number, date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    const list = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]") as Array<{
      date: string;
      minutes: number;
    }>;
    list.push({ date: iso(date), minutes: Math.max(1, Math.round(minutes)) });
    // Keep ~1 year
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 400);
    const trimmed = list.filter((s) => s.date >= iso(cutoff));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

function sessionsByDay(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const list = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]") as Array<{
      date: string;
      minutes: number;
    }>;
    const map: Record<string, number> = {};
    for (const s of list) map[s.date] = (map[s.date] || 0) + s.minutes;
    return map;
  } catch {
    return {};
  }
}

/** Always-available solo weekly stats (browser / no guild / no desktop). */
export function buildSoloWeeklyStats(): WeeklyStats {
  const today = new Date();
  const monday = mondayOf(today);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const byDay = sessionsByDay();
  const okr = loadSoloOkr();

  const days: WeeklyStatsDay[] = [];
  let workTotalMin = 0;
  let focusDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = iso(d);
    const mins = key <= iso(today) ? byDay[key] || 0 : 0;
    if (mins >= 25) focusDays += 1;
    if (key <= iso(today)) workTotalMin += mins;
    const score = mins >= 45 ? 85 : mins >= 25 ? 65 : mins > 0 ? 40 : 0;
    days.push({
      date: key,
      weekday: weekdays[i],
      work_seconds: mins * 60,
      distraction_seconds: 0,
      focus_minutes: mins,
      focus_score: score,
    });
  }

  // Streak
  let streak = 0;
  const cursor = new Date(today);
  for (let i = 0; i < 400; i++) {
    const key = iso(cursor);
    if ((byDay[key] || 0) >= 25) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (key === iso(today)) {
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }

  // 8-week history
  const history = [];
  for (let wk = 7; wk >= 0; wk--) {
    const wstart = new Date(monday);
    wstart.setDate(monday.getDate() - wk * 7);
    let wmins = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(wstart);
      d.setDate(wstart.getDate() + i);
      if (d > today) continue;
      wmins += byDay[iso(d)] || 0;
    }
    history.push({
      weekStart: iso(wstart),
      work_minutes: wmins,
      avg_focus_score: wmins > 0 ? 70 : 0,
    });
  }

  const workHours = Math.round((workTotalMin / 60) * 10) / 10;
  const scored = days.filter((d) => d.focus_score > 0);
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, d) => a + d.focus_score, 0) / scored.length)
    : 0;

  return {
    available: true,
    weekStart: iso(monday),
    days,
    history,
    kpis: {
      focus_hours: workHours,
      avg_focus_score: avgScore,
      distraction_hours: 0,
      streak,
      focus_days: focusDays,
    },
    league: league(workHours),
    okr: {
      focus_hours: { current: workHours, target: okr.focus_hours_target },
      focus_score: { current: avgScore, target: okr.focus_score_target },
      revenue: { current_eur: okr.revenue_current_eur, target_eur: okr.revenue_target_eur },
    },
  };
}
