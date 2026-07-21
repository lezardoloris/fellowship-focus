import { NextResponse } from "next/server";
import { getMemberByToken, getMemberPrefs, setMemberPrefs } from "@/lib/db";

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
  return NextResponse.json({ prefs: getMemberPrefs(member.id) }, { headers: corsHeaders });
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
    const prefs = setMemberPrefs(member.id, {
      focus_min: Number(body.focus_min) || 25,
      break_min: Number(body.break_min) || 5,
      cycles: Number(body.cycles) || 4,
    });
    return NextResponse.json({ prefs }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save prefs" }, { status: 500, headers: corsHeaders });
  }
}
