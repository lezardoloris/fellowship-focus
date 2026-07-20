import { NextResponse } from "next/server";
import { getMemberByToken, startFocusSession } from "@/lib/db";

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
    const sessionId = startFocusSession(member.id, member.fellowship_id);
    return NextResponse.json({ sessionId }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to start session" }, { status: 500, headers: corsHeaders });
  }
}
