export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  getMemberByToken,
  revokeMemberToken,
  rotateMemberToken,
} from "@/lib/db";
import { allowRate, clientKey } from "@/lib/rateLimit";

function bearer(req: Request, body?: { token?: string }) {
  return (
    body?.token ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    ""
  );
}

/** Rotate or revoke the caller's member bearer. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; action?: string };
    const token = bearer(request, body);
    if (!token) {
      return NextResponse.json({ error: "token_required" }, { status: 401 });
    }
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    if (!allowRate(clientKey(request, `token-ops:${member.id}`), 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    if (body.action === "revoke") {
      revokeMemberToken(member.id);
      return NextResponse.json({ ok: true, revoked: true });
    }

    const next = rotateMemberToken(member.id);
    if (!next) {
      return NextResponse.json({ error: "rotate_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, token: next });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
