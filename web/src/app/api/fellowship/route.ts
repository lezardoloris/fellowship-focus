import { NextResponse } from "next/server";
import { createFellowship, GUILD_NICHES, listPublicGuilds } from "@/lib/db";

/** Public guild ladder — browse by niche, no invite code required. */
export async function GET(request: Request) {
  const niche = new URL(request.url).searchParams.get("niche");
  const guilds = listPublicGuilds(niche && niche !== "all" ? niche : null);
  return NextResponse.json({
    niches: GUILD_NICHES,
    guilds,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name as string)?.trim() || "The Fellowship";
    const penalty = Number(body.blockerBypassPenalty) || 0;
    const niche = typeof body.niche === "string" ? body.niche : "deep-work";
    const objective = typeof body.objective === "string" ? body.objective : "";
    const visibility = body.visibility === "private" ? "private" : "public";
    const fellowship = createFellowship(name, penalty, { niche, objective, visibility });
    return NextResponse.json({ fellowship });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create fellowship" }, { status: 500 });
  }
}
