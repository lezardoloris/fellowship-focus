import { NextResponse } from "next/server";
import { getMemberByToken, getWeeklyProductivity, setMemberGoals } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
  }
  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
  }
  return NextResponse.json(getWeeklyProductivity(member.id), { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token as string;
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
    }
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }
    // Only revenue is manual; focus/habits progress is derived automatically.
    const goals: Record<string, number> = {};
    if (body.focus_hours_target != null) goals.focus_hours_target = Number(body.focus_hours_target);
    if (body.habit_rate_target != null) goals.habit_rate_target = Number(body.habit_rate_target);
    if (body.revenue_target_eur != null)
      goals.revenue_target_cents = Math.round(Number(body.revenue_target_eur) * 100);
    if (body.revenue_current_eur != null)
      goals.revenue_current_cents = Math.round(Number(body.revenue_current_eur) * 100);
    setMemberGoals(member.id, goals);
    return NextResponse.json(getWeeklyProductivity(member.id), { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save goals" }, { status: 500, headers: corsHeaders });
  }
}
