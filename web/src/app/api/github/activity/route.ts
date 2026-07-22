import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import {
  aggregateGithubEvents,
  fetchGithubJson,
  parseGithubUsername,
} from "@/lib/githubActivity";

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
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-only-change-me",
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("user") || "";
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

    const stats = aggregateGithubEvents(profile.data.login, events.data, {
      avatarUrl: profile.data.avatar_url,
      privateIncluded,
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load GitHub activity" }, { status: 500 });
  }
}
