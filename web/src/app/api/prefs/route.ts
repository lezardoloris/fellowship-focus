import { NextResponse } from "next/server";
import {
  getBlockerSettings,
  getMemberByToken,
  getMemberPrefs,
  setBlockerSettings,
  setMemberPrefs,
} from "@/lib/db";
import { mergeBlockerSettings } from "@/lib/blockerSettings";

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
  const settings = getBlockerSettings(member.id);
  return NextResponse.json(
    { prefs: { ...getMemberPrefs(member.id), ...settings } },
    { headers: corsHeaders }
  );
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
    const current = getBlockerSettings(member.id);
    // Field-scoped: never spread raw body (token, action, …) into settings.
    const nested = body.settings;
    const patch =
      nested && typeof nested === "object"
        ? (nested as Partial<typeof current>)
        : (() => {
            const rest = { ...(body as Record<string, unknown>) };
            delete rest.token;
            delete rest.action;
            delete rest.settings;
            return rest as Partial<typeof current>;
          })();
    const merged = mergeBlockerSettings({ ...current, ...patch });
    setBlockerSettings(member.id, merged);
    setMemberPrefs(member.id, {
      focus_min: merged.focus_min,
      break_min: merged.break_min,
      cycles: merged.cycles,
      settings_json: JSON.stringify(merged),
    });
    return NextResponse.json({ prefs: merged }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save prefs" }, { status: 500, headers: corsHeaders });
  }
}
