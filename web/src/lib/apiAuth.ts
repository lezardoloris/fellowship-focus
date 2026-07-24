import { NextResponse } from "next/server";
import { getMemberByToken, type Member } from "@/lib/db";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function optionsOk() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function jsonErr(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: corsHeaders });
}

export async function memberFromRequest(request: Request): Promise<Member | null> {
  let token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) {
    try {
      const url = new URL(request.url);
      token = url.searchParams.get("token") || "";
    } catch {
      /* ignore */
    }
  }
  if (!token && request.method !== "GET" && request.method !== "HEAD") {
    try {
      const body = await request.clone().json();
      token = (body.token as string) || "";
    } catch {
      /* ignore */
    }
  }
  if (!token) return null;
  return getMemberByToken(token) || null;
}
