/**
 * Focus activities — the blocks from PERSO.xlsx (Quotidien / STRAT sheets).
 *
 * Focus minutes alone say how long you sat down, not what moved. Tagging each
 * session with the block it belonged to is what turns the timer into a
 * productivity tracker: hours land in the right bucket and OKRs can target a
 * specific kind of work ("10h prospection/week"), not just raw time.
 */

export type ActivityId =
  | "prospection"
  | "client"
  | "seo"
  | "ads"
  | "learning"
  | "admin"
  | "content"
  | "other";

export type Activity = {
  id: ActivityId;
  label: string;
  emoji: string;
  /** Suggested time-of-day window from the Quotidien sheet, "HH:MM" 24h. */
  window?: { start: string; end: string };
  /** Counts toward revenue-generating work in the weekly split. */
  incomeDriving: boolean;
};

export const ACTIVITIES: Activity[] = [
  {
    id: "prospection",
    label: "Prospection",
    emoji: "🎯",
    window: { start: "10:30", end: "12:15" },
    incomeDriving: true,
  },
  {
    id: "client",
    label: "Client / Ops",
    emoji: "🛠",
    window: { start: "14:30", end: "16:00" },
    incomeDriving: true,
  },
  { id: "seo", label: "SEO", emoji: "🔍", incomeDriving: true },
  { id: "ads", label: "Ads", emoji: "📈", incomeDriving: true },
  {
    id: "learning",
    label: "Learning",
    emoji: "📚",
    window: { start: "16:00", end: "17:30" },
    incomeDriving: false,
  },
  {
    id: "admin",
    label: "Admin / Inbox",
    emoji: "📥",
    window: { start: "17:30", end: "18:00" },
    incomeDriving: false,
  },
  { id: "content", label: "Content", emoji: "🎬", incomeDriving: false },
  { id: "other", label: "Other", emoji: "•", incomeDriving: false },
];

const BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));

export function getActivity(id: string | null | undefined): Activity {
  return BY_ID.get((id || "") as ActivityId) ?? ACTIVITIES[ACTIVITIES.length - 1];
}

export function isActivityId(value: unknown): value is ActivityId {
  return typeof value === "string" && BY_ID.has(value as ActivityId);
}

/**
 * Best guess from the clock, used only to preselect the picker.
 * Never used to record a session: a wrong auto-tag is worse than no tag.
 */
export function suggestActivity(now = new Date()): ActivityId {
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  for (const a of ACTIVITIES) {
    if (a.window && a.window.start <= hm && hm < a.window.end) return a.id;
  }
  return "other";
}
