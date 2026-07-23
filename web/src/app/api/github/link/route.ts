import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { resolveAuthSecret } from "@/lib/authSecret";
import { getMemberByToken, getGithubLink, getGithubWeekTotals, linkGithubUser } from "@/lib/db";

async function readGithubJwt() {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return getToken({
    req: { headers: { cookie: cookieHeader } } as Parameters<typeof getToken>[0]["req"],
    secret: resolveAuthSecret(),
  });
}

/** Link the signed-in GitHub account to a fellowship member token. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token as string;
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const jwt = await readGithubJwt();
    const login = typeof jwt?.githubLogin === "string" ? jwt.githubLogin : null;
    if (!login) {
      return NextResponse.json({ error: "Connect GitHub OAuth first" }, { status: 400 });
    }

    const link = linkGithubUser(member.id, login, null);
    const week = getGithubWeekTotals(member.id);
    return NextResponse.json({ link, week });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Link failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  const member = getMemberByToken(token);
  if (!member) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  return NextResponse.json({
    link: getGithubLink(member.id),
    week: getGithubWeekTotals(member.id),
  });
}
