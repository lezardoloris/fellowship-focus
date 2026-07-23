export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureGoogleUser,
  getFellowshipById,
  getMemberByToken,
  revealMemberToken,
} from "@/lib/db";

/** Linked guild membership for the Google account, if any (excludes personal Solo · fellowships). */
function linkedGuild(plaintextToken: string): { code: string; name: string; token: string } | null {
  const member = getMemberByToken(plaintextToken);
  if (!member) return null;
  const fellowship = getFellowshipById(member.fellowship_id);
  if (!fellowship) return null;
  if (fellowship.name.startsWith("Solo ·")) return null;
  return {
    code: fellowship.code.toLowerCase(),
    name: member.name,
    token: plaintextToken,
  };
}

/** Returns the signed-in Google user + linked blocker token (creates solo account if needed). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ authenticated: false });
  }

  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) {
    return NextResponse.json({ authenticated: false, error: "missing_google_id" });
  }

  const user = ensureGoogleUser({
    googleId,
    email: session.user.email,
    name: session.user.name || session.user.email.split("@")[0],
    avatarUrl: session.user.image || null,
  });

  const plaintext =
    user.plaintextToken ||
    (user.member_id ? revealMemberToken(user.member_id) : null);
  if (!plaintext) {
    return NextResponse.json(
      { authenticated: true, error: "token_revoked", user: { id: user.id, name: user.name, email: user.email } },
      { status: 403 }
    );
  }

  const guild = linkedGuild(plaintext);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      token: plaintext,
      googleId: user.google_id,
      fellowshipCode: guild?.code ?? null,
      memberName: guild?.name ?? null,
    },
  });
}

/** Link an existing fellowship member token to the signed-in Google account. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) {
    return NextResponse.json({ error: "missing_google_id" }, { status: 400 });
  }

  const body = (await req.json()) as { token?: string };
  if (!body.token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const member = getMemberByToken(body.token);
  if (!member) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  const user = ensureGoogleUser({
    googleId,
    email: session.user.email,
    name: session.user.name || member.name,
    avatarUrl: session.user.image || null,
    linkMemberId: member.id,
  });

  const plaintext =
    user.plaintextToken ||
    revealMemberToken(member.id) ||
    body.token;
  const guild = linkedGuild(plaintext);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      token: plaintext,
      fellowshipCode: guild?.code ?? null,
      memberName: guild?.name ?? null,
    },
  });
}
