import { NextResponse } from "next/server";
import { getMemberByToken, logSession } from "@/lib/db";
import { allowRate, clientKey } from "@/lib/rateLimit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Anti-cheat lite: clamp claimed minutes and rate-limit completions. */
const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token =
      (body.token as string) ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    let minutes = Number(body.minutes) || 0;
    const completed = body.completed !== false;
    const sessionId = body.sessionId as string | undefined;
    const activityScore = Number(body.activityScore) || 0;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
    }

    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    if (!Number.isFinite(minutes) || minutes < MIN_MINUTES) {
      return NextResponse.json(
        { error: `minutes must be between ${MIN_MINUTES} and ${MAX_MINUTES}` },
        { status: 400, headers: corsHeaders }
      );
    }
    minutes = Math.min(MAX_MINUTES, Math.round(minutes));

    // Soft anti-cheat: at most ~12 completed sessions / hour per member.
    if (completed && !allowRate(`session:${member.id}`, 12, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Session rate limit — slow down." },
        { status: 429, headers: corsHeaders }
      );
    }
    // Also bound by client IP for anonymous abuse of stolen tokens.
    if (completed && !allowRate(clientKey(request, "sessions"), 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many session posts from this network." },
        { status: 429, headers: corsHeaders }
      );
    }

    const result = logSession(
      member.id,
      member.fellowship_id,
      minutes,
      completed,
      sessionId,
      activityScore
    );
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to log session" }, { status: 500, headers: corsHeaders });
  }
}
