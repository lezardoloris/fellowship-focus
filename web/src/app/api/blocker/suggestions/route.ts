import { NextResponse } from "next/server";
import {
  getHistorySuggestions,
  getMemberByToken,
  getGoogleUserByToken,
  saveHistorySuggestions,
} from "@/lib/db";

function resolveOwner(token: string | null): { ownerId: string; kind: "member" | "google" } | null {
  if (!token) return null;
  const member = getMemberByToken(token);
  if (member) return { ownerId: member.id, kind: "member" };
  const google = getGoogleUserByToken(token);
  if (google) return { ownerId: google.member_id || google.id, kind: "google" };
  return null;
}

/** Fetch saved domain suggestions for the signed-in / token user. */
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  const owner = resolveOwner(token);
  if (!owner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const suggestions = getHistorySuggestions(owner.ownerId);
  return NextResponse.json({ suggestions });
}

/**
 * Extension posts aggregated browsing domains (no full URLs).
 * Body: { domains: [{ domain, visits, lastVisit }] }
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  const owner = resolveOwner(token);
  if (!owner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    domains?: Array<{ domain: string; visits: number; lastVisit?: number }>;
  };
  if (!Array.isArray(body.domains)) {
    return NextResponse.json({ error: "domains_required" }, { status: 400 });
  }

  const saved = saveHistorySuggestions(owner.ownerId, body.domains);
  return NextResponse.json({ ok: true, suggestions: saved });
}
