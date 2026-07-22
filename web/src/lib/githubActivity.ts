/** Parse a GitHub username from @handle, bare login, or profile/repo URL. */
export function parseGithubUsername(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : raw.includes("github.com") ? `https://${raw}` : null;
    if (withProto) {
      const url = new URL(withProto);
      if (!url.hostname.replace(/^www\./, "").endsWith("github.com")) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const reserved = new Set([
        "orgs",
        "users",
        "settings",
        "login",
        "signup",
        "explore",
        "topics",
        "marketplace",
        "notifications",
        "pulls",
        "issues",
        "search",
      ]);
      if (parts[0] && !reserved.has(parts[0].toLowerCase())) {
        return sanitizeLogin(parts[0]);
      }
      return null;
    }
  } catch {
    /* fall through */
  }

  return sanitizeLogin(raw.replace(/^@/, "").split(/[/?#\s]/)[0] || "");
}

function sanitizeLogin(login: string): string | null {
  const u = login.trim();
  if (!u) return null;
  // GitHub login: 1–39 chars, alphanumeric or hyphen, no leading/trailing hyphen
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(u)) return null;
  return u;
}

export type GithubWeekStats = {
  user: string;
  avatarUrl: string | null;
  commits: number;
  prs: number;
  reviews: number;
  issues: number;
  repos: number;
  activeDays: number;
  perDay: Record<string, number>;
  topRepos: string[];
  privateIncluded: boolean;
};

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

export function aggregateGithubEvents(
  login: string,
  events: GhEvent[],
  opts?: { avatarUrl?: string | null; privateIncluded?: boolean; days?: number }
): GithubWeekStats {
  const days = opts?.days ?? 7;
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const perDay: Record<string, number> = {};
  const repoSet = new Set<string>();
  let commits = 0;
  let prs = 0;
  let reviews = 0;
  let issues = 0;

  for (const ev of events) {
    const t = new Date(ev.created_at).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    const day = ev.created_at.slice(0, 10);
    const repo = ev.repo?.name;
    if (repo) repoSet.add(repo);

    let weight = 0;
    switch (ev.type) {
      case "PushEvent": {
        const n = ev.payload?.size ?? ev.payload?.commits?.length ?? 0;
        commits += n;
        weight = n;
        break;
      }
      case "PullRequestEvent": {
        if (ev.payload?.action === "opened" || ev.payload?.pull_request?.merged) {
          prs += 1;
          weight = 1;
        }
        break;
      }
      case "PullRequestReviewEvent": {
        reviews += 1;
        weight = 1;
        break;
      }
      case "IssuesEvent": {
        if (ev.payload?.action === "opened" || ev.payload?.action === "closed") {
          issues += 1;
          weight = 1;
        }
        break;
      }
      case "CreateEvent":
      case "CommitCommentEvent":
      case "IssueCommentEvent":
      case "PullRequestReviewCommentEvent":
        weight = 1;
        break;
      default:
        break;
    }
    if (weight > 0) perDay[day] = (perDay[day] || 0) + weight;
  }

  const topRepos = [...repoSet]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 5)
    .map((r) => r.split("/").pop() || r);

  return {
    user: login,
    avatarUrl: opts?.avatarUrl ?? null,
    commits,
    prs,
    reviews,
    issues,
    repos: repoSet.size,
    activeDays: Object.keys(perDay).length,
    perDay,
    topRepos,
    privateIncluded: Boolean(opts?.privateIncluded),
  };
}

export async function fetchGithubJson<T>(
  path: string,
  token?: string | null
): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; error: string }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "FellowshipFocus",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const error =
      res.status === 404
        ? "User not found"
        : res.status === 403
          ? "GitHub rate limit — connect with OAuth or try later"
          : `GitHub error (${res.status})`;
    return { ok: false, status: res.status, error };
  }

  return { ok: true, data: (await res.json()) as T, status: res.status };
}
