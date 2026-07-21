import { NextResponse } from "next/server";
import {
  addBlocklistSites,
  getBlocklist,
  getMemberByToken,
  removeBlocklistSite,
} from "@/lib/db";

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
  return NextResponse.json({ sites: getBlocklist(member.id) }, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token as string;
    const action = body.action as string;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
    }
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    let sites;
    if (action === "add") {
      const list: string[] = Array.isArray(body.sites)
        ? body.sites
        : body.site
          ? [body.site]
          : [];
      sites = addBlocklistSites(member.id, list, body.category ?? null);
    } else if (action === "remove") {
      sites = removeBlocklistSite(member.id, String(body.site || ""));
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ sites }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update block list" }, { status: 500, headers: corsHeaders });
  }
}
