import { NextResponse } from "next/server";
import { getMemberByToken, recordAppUsage } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
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

    const usage = recordAppUsage(member.id, member.fellowship_id, {
      workSeconds: Math.max(0, Number(body.workSeconds) || 0),
      distractionSeconds: Math.max(0, Number(body.distractionSeconds) || 0),
      personalSeconds: Math.max(0, Number(body.personalSeconds) || 0),
      neutralSeconds: Math.max(0, Number(body.neutralSeconds) || 0),
      focusScore: Math.max(0, Math.min(100, Number(body.focusScore) || 0)),
    });

    return NextResponse.json({ ok: true, usage }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to record usage" }, { status: 500, headers: corsHeaders });
  }
}
