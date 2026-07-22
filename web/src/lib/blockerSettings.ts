/** Unified blocker settings synced across web · extension · desktop. */

export type HardMode = "off" | "confirm" | "delay" | "phrase";
export type SiteMode = "hard" | "friction";

export type ScheduleRule = {
  id: string;
  label: string;
  /** 0=Sun … 6=Sat */
  days: number[];
  start: string; // "09:00"
  end: string; // "18:00"
  locked: boolean;
};

export type BlockerSettings = {
  focus_min: number;
  focus_sec: number;
  break_min: number;
  cycles: number;
  alarm_secs: number;
  alarm_vol: number;
  anti_oops: boolean;
  hard_mode: HardMode;
  hard_delay_secs: number;
  hard_phrase: string;
  allowlist: string[];
  schedules: ScheduleRule[];
  /** ISO timestamp — shield locked until then */
  quick_lock_until: string | null;
  /** per-domain mode override */
  site_modes: Record<string, SiteMode>;
  friction_secs: number;
};

export const DEFAULT_BLOCKER_SETTINGS: BlockerSettings = {
  focus_min: 45,
  focus_sec: 0,
  break_min: 5,
  cycles: 4,
  alarm_secs: 10,
  alarm_vol: 0.6,
  anti_oops: true,
  hard_mode: "confirm",
  hard_delay_secs: 30,
  hard_phrase: "i will focus",
  allowlist: ["github.com", "docs.google.com", "stackoverflow.com", "notion.so"],
  schedules: [],
  quick_lock_until: null,
  site_modes: {},
  friction_secs: 8,
};

export function mergeBlockerSettings(
  partial?: Partial<BlockerSettings> | null
): BlockerSettings {
  const base = { ...DEFAULT_BLOCKER_SETTINGS, ...(partial || {}) };
  base.allowlist = Array.isArray(base.allowlist)
    ? [...new Set(base.allowlist.map(normDomain).filter(Boolean))]
    : [...DEFAULT_BLOCKER_SETTINGS.allowlist];
  base.schedules = Array.isArray(base.schedules) ? base.schedules : [];
  base.site_modes =
    base.site_modes && typeof base.site_modes === "object" ? base.site_modes : {};
  base.hard_mode = (["off", "confirm", "delay", "phrase"] as HardMode[]).includes(
    base.hard_mode
  )
    ? base.hard_mode
    : "confirm";
  return base;
}

export function normDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .slice(0, 120);
}

/** True if shield should be forced on by schedule or quick lock. */
export function shieldForcedOn(
  settings: BlockerSettings,
  now = new Date()
): { on: boolean; reason: string | null; locked: boolean } {
  if (settings.quick_lock_until) {
    const until = new Date(settings.quick_lock_until).getTime();
    if (until > now.getTime()) {
      return { on: true, reason: "quick_lock", locked: true };
    }
  }
  const day = now.getDay();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  for (const rule of settings.schedules) {
    if (!rule.days?.includes(day)) continue;
    if (rule.start <= hm && hm < rule.end) {
      return { on: true, reason: rule.label || "schedule", locked: Boolean(rule.locked) };
    }
  }
  return { on: false, reason: null, locked: false };
}

export function isAllowlisted(domain: string, allowlist: string[]): boolean {
  const d = normDomain(domain);
  return allowlist.some((a) => d === a || d.endsWith(`.${a}`));
}
