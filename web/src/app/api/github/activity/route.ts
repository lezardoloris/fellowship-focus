import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import {
  aggregateGithubEvents,
  fetchGithubJson,
  parseGithubUsername,
  type GithubWeekStats,
} from "@/lib/githubActivity";
import { cacheGet, cacheSet, rateLimitAllow } from "@/lib/githubCache";
import { resolveAuthSecret } from "@/lib/authSecret";
import {
  getMemberByToken,
  syncGithubActivityFromStats,
  getGithubLink,
  getGithubWeekTotals,
} from "@/lib/db";

type GhUser = { login: string; avatar_url: string };
type GhEvent = {
  type: string;
  created_at: string;
  repo?: { name: string };
  payload?: {
    size?: number;
    commits?: unknown[];
    action?: string;
    pull_request?: { merged?: boolean };
  };
};

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

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export async function GET(request: Request) {
  try {
    if (!rateLimitAllow(clientIp(request))) {
      return NextResponse.json({ error: "Too many requests — try again in a minute" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("user") || "";
    const memberToken = searchParams.get("token") || "";
    const login = parseGithubUsername(raw);
    if (!login) {
      return NextResponse.json(
        { error: "Enter a GitHub username or profile URL" },
        { status: 400 }
      );
    }

    const jwt = await readGithubJwt();
    const sessionLogin = typeof jwt?.githubLogin === "string" ? jwt.githubLogin : null;
    const sessionToken =
      typeof jwt?.githubAccessToken === "string" ? jwt.githubAccessToken : null;
    const envToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || null;

    const sameUser =
      Boolean(sessionLogin && sessionToken) &&
      sessionLogin!.toLowerCase() === login.toLowerCase();
    const token = sameUser ? sessionToken : envToken;
    const privateIncluded = sameUser;

    const cacheKey = `${login.toLowerCase()}:${privateIncluded ? "priv" : "pub"}`;
    let stats = cacheGet<GithubWeekStats>(cacheKey);

    if (!stats) {
      const profile = await fetchGithubJson<GhUser>(`/users/${encodeURIComponent(login)}`, token);
      if (!profile.ok) {
        return NextResponse.json({ error: profile.error }, { status: profile.status });
      }

      const eventsPath = privateIncluded
        ? `/users/${encodeURIComponent(profile.data.login)}/events?per_page=100`
        : `/users/${encodeURIComponent(profile.data.login)}/events/public?per_page=100`;

      const events = await fetchGithubJson<GhEvent[]>(eventsPath, token);
      if (!events.ok) {
        return NextResponse.json({ error: events.error }, { status: events.status });
      }

      stats = aggregateGithubEvents(profile.data.login, events.data, {
        avatarUrl: profile.data.avatar_url,
        privateIncluded,
      });
      cacheSet(cacheKey, stats);
    }

    let sync: { xpAwarded: number; todayCommits: number } | null = null;
    let week: ReturnType<typeof getGithubWeekTotals> | null = null;
    let linked = false;

    if (memberToken) {
      const member = getMemberByToken(memberToken);
      if (member && sameUser) {
        sync = syncGithubActivityFromStats(member.id, member.fellowship_id, stats);
        week = getGithubWeekTotals(member.id);
        linked = Boolean(getGithubLink(member.id));
      } else if (member) {
        week = getGithubWeekTotals(member.id);
        linked = Boolean(getGithubLink(member.id));
      }
    }

    return NextResponse.json({ ...stats, sync, week, linked });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load GitHub activity" }, { status: 500 });
  }
}
