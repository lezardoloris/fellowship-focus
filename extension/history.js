/* Analyze Chrome browsing history → ranked distractor domains.
   Raw URLs never leave the browser; only aggregated domains are returned. */

const DISTRACTORS = {
  "youtube.com": 40,
  "x.com": 40,
  "twitter.com": 40,
  "reddit.com": 38,
  "instagram.com": 38,
  "tiktok.com": 42,
  "facebook.com": 35,
  "netflix.com": 40,
  "twitch.tv": 38,
  "linkedin.com": 20,
  "news.google.com": 25,
  "cnn.com": 22,
  "bbc.com": 22,
  "amazon.com": 18,
  "ebay.com": 16,
  "pinterest.com": 30,
  "discord.com": 22,
  "web.whatsapp.com": 18,
};

/** Social / video / news (and close cousins) — used for "Block this site?" prompts
 * during an active shield. Mirrors BlockTab CATEGORIES + DISTRACTORS. */
const DOPAMINE_SITES = new Set([
  ...Object.keys(DISTRACTORS),
  "primevideo.com",
  "disneyplus.com",
  "lemonde.fr",
  "threads.net",
]);

/**
 * Map a hostname to a canonical dopamine apex, or null.
 * @param {string} host
 * @param {Record<string, string[]>} [aliases] domain → alias list (from background)
 */
function matchDopamineDomain(host, aliases) {
  const h = String(host || "")
    .replace(/^www\./, "")
    .toLowerCase();
  if (!h) return null;
  for (const d of DOPAMINE_SITES) {
    if (h === d || h.endsWith("." + d)) return d;
  }
  if (aliases && typeof aliases === "object") {
    for (const [base, list] of Object.entries(aliases)) {
      if (!DOPAMINE_SITES.has(base)) continue;
      for (const a of list || []) {
        if (h === a || h.endsWith("." + a)) return base;
      }
    }
  }
  return null;
}

const WORK = new Set([
  "github.com",
  "gitlab.com",
  "stackoverflow.com",
  "docs.google.com",
  "drive.google.com",
  "mail.google.com",
  "calendar.google.com",
  "notion.so",
  "linear.app",
  "vercel.com",
  "railway.app",
  "figma.com",
  "slack.com",
  "zoom.us",
  "meet.google.com",
  "chatgpt.com",
  "claude.ai",
  "cursor.com",
]);

function hostnameOf(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function scoreDomain(domain, visits) {
  if (!domain || WORK.has(domain)) return 0;
  const base = DISTRACTORS[domain] ?? (visits >= 20 ? 15 : visits >= 8 ? 8 : 0);
  if (base === 0) return 0;
  return base + Math.min(30, Math.floor(Math.log2(Math.max(1, visits)) * 4));
}

/**
 * @returns {Promise<Array<{ domain: string, visits: number, lastVisit: number, score: number }>>}
 */
async function analyzeHistory(days = 30) {
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const items = await chrome.history.search({
    text: "",
    startTime,
    maxResults: 5000,
  });

  const map = new Map();
  for (const item of items) {
    const domain = hostnameOf(item.url || "");
    if (!domain) continue;
    const prev = map.get(domain) || { domain, visits: 0, lastVisit: 0 };
    prev.visits += item.visitCount || 1;
    prev.lastVisit = Math.max(prev.lastVisit, item.lastVisitTime || 0);
    map.set(domain, prev);
  }

  return [...map.values()]
    .map((d) => ({ ...d, score: scoreDomain(d.domain, d.visits) }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || b.visits - a.visits)
    .slice(0, 40);
}

async function pushSuggestions(domains) {
  const cfg = await getConfig();
  if (!cfg.apiUrl || !cfg.token) return { pushed: false, reason: "not_connected" };
  try {
    const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/api/blocker/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        domains: domains.map((d) => ({
          domain: d.domain,
          visits: d.visits,
          lastVisit: d.lastVisit,
        })),
      }),
    });
    return { pushed: res.ok, status: res.status };
  } catch (e) {
    return { pushed: false, reason: String(e) };
  }
}
