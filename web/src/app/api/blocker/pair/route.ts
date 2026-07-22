import { NextResponse } from "next/server";
import {
  consumePairCode,
  createPairCode,
  getMemberByToken,
  getFellowshipById,
} from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/** Create a short-lived pair code for one-click extension connect. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = (body.token as string) || "";
    if (!token) {
      return NextResponse.json({ error: "token_required" }, { status: 401, headers: corsHeaders });
    }
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: corsHeaders });
    }
    const pair = createPairCode(member.id, token);
    const fellowship = getFellowshipById(member.fellowship_id);
    const origin = new URL(request.url).origin;
    const pairUrl = `${origin}/pair?code=${pair.code}`;
    return NextResponse.json(
      {
        code: pair.code,
        expires_at: pair.expires_at,
        pairUrl,
        payload: {
          apiUrl: origin,
          token,
          code: fellowship?.code || "",
          name: member.name,
        },
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500, headers: corsHeaders });
  }
}

/** Extension redeems pair code → credentials. */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  if (!code) {
    return NextResponse.json({ error: "code_required" }, { status: 400, headers: corsHeaders });
  }
  const consumed = consumePairCode(code);
  if (!consumed) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 404, headers: corsHeaders });
  }
  const member = getMemberByToken(consumed.token);
  if (!member) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: corsHeaders });
  }
  const fellowship = getFellowshipById(member.fellowship_id);
  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      apiUrl: origin,
      token: consumed.token,
      code: fellowship?.code || "",
      name: member.name,
    },
    { headers: corsHeaders }
  );
}
