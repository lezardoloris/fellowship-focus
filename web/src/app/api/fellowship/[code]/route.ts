import { NextResponse } from "next/server";
import {
  getFellowshipByCode,
  getFellowshipHabitLeaderboard,
  getFellowshipStats,
  getFellowshipTotalXp,
  getFeed,
  getMemberByToken,
  getMembers,
  getTrustLeaderboard,
  getWeeklyLeaderboard,
} from "@/lib/db";
import { toPublicMember } from "@/lib/publicMember";
import { getCurrentWaypoint, getNextWaypoint, getProgressToNext } from "@/lib/waypoints";

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

export async function GET(
  request: Request,
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
    const members = getMembers(fellowship.id).map(toPublicMember);
    const leaderboard = getWeeklyLeaderboard(fellowship.id);
    const habitLeaderboard = getFellowshipHabitLeaderboard(fellowship.id);
    const trustLeaderboard = getTrustLeaderboard(fellowship.id);
    const feed = getFeed(fellowship.id);
    const currentWaypoint = getCurrentWaypoint(totalXp);
    const nextWaypoint = getNextWaypoint(totalXp);
    const progress = getProgressToNext(totalXp);

    // Identify "me" from the caller's own bearer — never by scanning member tokens.
    let me: { id: string; name: string } | null = null;
    const own = bearerToken(request);
    if (own) {
      const member = getMemberByToken(own);
      if (member && member.fellowship_id === fellowship.id) {
        me = { id: member.id, name: member.name };
      }
    }

    return NextResponse.json({
      fellowship,
      totalXp,
      stats,
      members,
      me,
      leaderboard,
      habitLeaderboard,
      trustLeaderboard,
      feed,
      journey: { currentWaypoint, nextWaypoint, progress },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load fellowship" }, { status: 500 });
  }
}
