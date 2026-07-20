import { NextResponse } from "next/server";
import { getMemberByToken, logBlock } from "@/lib/db";

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
    const site = (body.site as string)?.trim();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
    }

    if (!site) {
      return NextResponse.json({ error: "Site required" }, { status: 400, headers: corsHeaders });
    }

    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    const result = logBlock(member.id, member.fellowship_id, site);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to log block" }, { status: 500, headers: corsHeaders });
  }
}
