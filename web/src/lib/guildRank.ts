/**
 * Guild rank + cosmetic titles (Quiet Luxury Fellowship).
 * Rank from personal total XP; titles unlock with fellowship journey waypoints.
 */

import { WAYPOINTS, type Waypoint } from "@/lib/waypoints";

export function xpToRank(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  return Math.min(99, Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1));
}

export function rankXpFloor(rank: number): number {
  const r = Math.max(1, Math.min(99, rank));
  return Math.floor(50 * (r - 1) * (r - 1));
}

export function rankProgress(totalXp: number): {
  rank: number;
  xpInto: number;
  xpNeed: number;
  percent: number;
} {
  const rank = xpToRank(totalXp);
  if (rank >= 99) {
    return { rank: 99, xpInto: 0, xpNeed: 0, percent: 100 };
  }
  const floor = rankXpFloor(rank);
  const next = rankXpFloor(rank + 1);
  const xpInto = Math.max(0, totalXp - floor);
  const xpNeed = Math.max(1, next - floor);
  return {
    rank,
    xpInto,
    xpNeed,
    percent: Math.min(100, Math.round((xpInto / xpNeed) * 100)),
  };
}

/** Cosmetic title tied to the highest waypoint the fellowship has reached. */
export function titleForWaypoint(wp: Waypoint): string {
  const map: Record<string, string> = {
    "bag-end": "Shire Softling",
    bree: "Inn Companion",
    weathertop: "Wound Walker",
    rivendell: "Council Voice",
    moria: "Balrog Slayer",
    lothlorien: "Mirror Keeper",
    "helms-deep": "Dawn Holder",
    "minas-tirith": "White Banner",
    "mount-doom": "Ring-bearer",
  };
  return map[wp.id] || wp.unlock;
}

export function unlockedTitles(fellowshipXp: number): { id: string; title: string; waypoint: string }[] {
  return WAYPOINTS.filter((wp) => fellowshipXp >= wp.xpRequired).map((wp) => ({
    id: wp.id,
    title: titleForWaypoint(wp),
    waypoint: wp.name,
  }));
}

export function currentTitle(fellowshipXp: number): string {
  const list = unlockedTitles(fellowshipXp);
  return list[list.length - 1]?.title || "Shire Softling";
}

export function leagueAccent(league: string): string {
  switch (league) {
    case "Mordor":
      return "#f97316";
    case "Gondor":
      return "#d4a574";
    case "Rohan":
      return "#60a5fa";
    default:
      return "#9ca3af";
  }
}
