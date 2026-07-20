export type Waypoint = {
  id: string;
  name: string;
  xpRequired: number;
  order: number;
  storyTitle: string;
  story: string;
  unlock: string;
};

export const WAYPOINTS: Waypoint[] = [
  {
    id: "bag-end",
    name: "Bag End",
    xpRequired: 0,
    order: 0,
    storyTitle: "The Unexpected Party",
    story:
      "You were comfortable. The Shire was warm. Then Gandalf knocked — and you realized comfort was the real distraction. Today you leave Bag End.",
    unlock: "Fellowship created. Share your link.",
  },
  {
    id: "bree",
    name: "Bree",
    xpRequired: 500,
    order: 1,
    storyTitle: "The Prancing Pony",
    story:
      "At the Prancing Pony, Strider watched from the shadows. So do your blocked sites — they wait for you to slip. Stay one more Pomodoro.",
    unlock: "Inn Rest badge (3 sessions in one day).",
  },
  {
    id: "weathertop",
    name: "Weathertop",
    xpRequired: 1200,
    order: 2,
    storyTitle: "The Wound",
    story:
      "Frodo put on the Ring on Weathertop. One moment of weakness — and the wound never fully heals. Every tab to a blocked site is a Ring on your finger.",
    unlock: "Hard Mode (tab-switch = session fail).",
  },
  {
    id: "rivendell",
    name: "Rivendell",
    xpRequired: 2500,
    order: 3,
    storyTitle: "The Council",
    story:
      "Elrond did not ask who was strongest. He asked who would go. Your Fellowship gathers here — the ladder shows who marched hardest; the map shows you march together.",
    unlock: "Weekly challenges unlocked.",
  },
  {
    id: "moria",
    name: "Moria",
    xpRequired: 5000,
    order: 4,
    storyTitle: "The Bridge",
    story:
      "You cannot pass. Gandalf stood on the Bridge so the Fellowship could run. Your streak is that bridge — miss a day and the Balrog takes your Torch.",
    unlock: "Balrog Slayer title (30-day streak).",
  },
  {
    id: "lothlorien",
    name: "Lothlórien",
    xpRequired: 10000,
    order: 5,
    storyTitle: "The Mirror",
    story:
      "Galadriel showed Frodo what would happen if he failed. Your dashboard shows days focused, sites resisted, friends still walking.",
    unlock: "Golden map skin.",
  },
  {
    id: "helms-deep",
    name: "Helm's Deep",
    xpRequired: 20000,
    order: 6,
    storyTitle: "The Dawn",
    story:
      "They said it was over at midnight. The Fellowship held until the sun rose. Hold your weekly rank until dawn.",
    unlock: "Champion of the Deep (top of weekly ladder).",
  },
  {
    id: "minas-tirith",
    name: "Minas Tirith",
    xpRequired: 35000,
    order: 7,
    storyTitle: "The Siege",
    story:
      "Minas Tirith fell when people stopped showing up. Your Fellowship doesn't need heroes — it needs everyone to complete their daily quest.",
    unlock: "Fellowship banner on map.",
  },
  {
    id: "mount-doom",
    name: "Mount Doom",
    xpRequired: 50000,
    order: 8,
    storyTitle: "The Destruction",
    story:
      "Frodo couldn't destroy the Ring alone. Sam carried him up the mountain. Your Fellowship carried you here. Throw it in the fire.",
    unlock: "Ring Destroyed. Journey complete.",
  },
];

export { DEFAULT_BLOCKED_SITES } from "./blocklist";

export function getCurrentWaypoint(totalXp: number): Waypoint {
  let current = WAYPOINTS[0];
  for (const wp of WAYPOINTS) {
    if (totalXp >= wp.xpRequired) current = wp;
  }
  return current;
}

export function getNextWaypoint(totalXp: number): Waypoint | null {
  for (const wp of WAYPOINTS) {
    if (totalXp < wp.xpRequired) return wp;
  }
  return null;
}

export function getProgressToNext(totalXp: number): number {
  const current = getCurrentWaypoint(totalXp);
  const next = getNextWaypoint(totalXp);
  if (!next) return 100;
  const range = next.xpRequired - current.xpRequired;
  const progress = totalXp - current.xpRequired;
  return Math.min(100, Math.round((progress / range) * 100));
}

export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}
