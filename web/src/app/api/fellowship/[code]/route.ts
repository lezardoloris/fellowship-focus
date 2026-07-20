import { NextResponse } from "next/server";
import {
  getFellowshipByCode,
  getFellowshipHabitLeaderboard,
  getFellowshipStats,
  getFellowshipTotalXp,
  getFeed,
  getMembers,
  getWeeklyLeaderboard,
} from "@/lib/db";
import { getCurrentWaypoint, getNextWaypoint, getProgressToNext } from "@/lib/waypoints";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const fellowship = getFellowshipByCode(code);
    if (!fellowship) {
      return NextResponse.json({ error: "Fellowship not found" }, { status: 404 });
    }

    const totalXp = getFellowshipTotalXp(fellowship.id);
    const stats = getFellowshipStats(fellowship.id);
    const members = getMembers(fellowship.id);
    const leaderboard = getWeeklyLeaderboard(fellowship.id);
    const habitLeaderboard = getFellowshipHabitLeaderboard(fellowship.id);
    const feed = getFeed(fellowship.id);
    const currentWaypoint = getCurrentWaypoint(totalXp);
    const nextWaypoint = getNextWaypoint(totalXp);
    const progress = getProgressToNext(totalXp);

    return NextResponse.json({
      fellowship,
      totalXp,
      stats,
      members,
      leaderboard,
      habitLeaderboard,
      feed,
      journey: { currentWaypoint, nextWaypoint, progress },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load fellowship" }, { status: 500 });
  }
}
