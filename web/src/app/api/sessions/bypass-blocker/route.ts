import { NextResponse } from "next/server";
import { getMemberByToken, logBlockerBypass } from "@/lib/db";

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
    const sessionId = body.sessionId as string;
    if (!token || !sessionId) {
      return NextResponse.json({ error: "Token and sessionId required" }, { status: 400, headers: corsHeaders });
    }
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }
    const result = logBlockerBypass(member.id, member.fellowship_id, sessionId);
    return NextResponse.json(
      { ok: true, penalty: result?.penalty ?? 0, member: result?.member },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to log bypass" }, { status: 500, headers: corsHeaders });
  }
}
