import { NextResponse } from "next/server";
import { getMemberByToken, logSession } from "@/lib/db";

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
    const minutes = Number(body.minutes) || 0;
    const completed = body.completed !== false;
    const sessionId = body.sessionId as string | undefined;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
    }

    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    const result = logSession(member.id, member.fellowship_id, minutes, completed, sessionId);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to log session" }, { status: 500, headers: corsHeaders });
  }
}
