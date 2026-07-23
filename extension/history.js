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

/** Social / video / news / games (+ cousins) — soft "Back to work?" nudges during
 * an active shield when the host is not yet on the blocklist.
 * Mirrors BlockTab CATEGORIES + DISTRACTORS. */
const DOPAMINE_SITES = new Set([
  ...Object.keys(DISTRACTORS),
  "primevideo.com",
  "disneyplus.com",
  "hulu.com",
  "max.com",
  "crunchyroll.com",
  "lemonde.fr",
  "threads.net",
  "aliexpress.com",
  "roblox.com",
  "steampowered.com",
  "epicgames.com",
]);

/**
 * Adult / porn apexes — same "Back to work?" soft nudge, higher priority than
 * DOPAMINE_SITES. Includes common tube sites not always on the default list.
 */
const ADULT_SITES = new Set([
  "pornhub.com",
  "xvideos.com",
  "xhamster.com",
  "xnxx.com",
  "redtube.com",
  "youporn.com",
  "tube8.com",
  "spankbang.com",
  "onlyfans.com",
  "chaturbate.com",
  "stripchat.com",
  "livejasmin.com",
  "bongacams.com",
  "porntube.com",
  "porn.com",
  "xhamster.desi",
  "xhopen.com",
  "nhentai.net",
  "rule34.xxx",
  "gelbooru.com",
  "hanime.tv",
  "brazzers.com",
  "realitykings.com",
  "eporner.com",
  "hqporner.com",
  "tnaflix.com",
  "beeg.com",
  "pornmd.com",
]);

/** High-precision query tokens for search SERPs (avoid bare "sex"). */
const ADULT_SEARCH_TERMS = new Set([
  "porn",
  "porno",
  "xxx",
  "nsfw",
  "hentai",
  "pornhub",
  "xvideos",
  "xhamster",
  "xnxx",
  "onlyfans",
  "chaturbate",
  "redtube",
  "youporn",
  "rule34",
  "brazzers",
  "spankbang",
  "nhentai",
]);

/** Obvious NSFW subreddit names only — do not match all of reddit. */
const ADULT_REDDIT_SUBS = new Set([
  "porn",
  "nsfw",
  "gonewild",
  "nsfw_gif",
  "realgirls",
  "porninfifteenseconds",
  "rule34",
  "hentai",
  "adultgif",
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

/**
 * Map a hostname to a canonical adult apex, or null.
 * Also treats the .xxx TLD as adult.
 * @param {string} host
 */
function matchAdultDomain(host) {
  const h = String(host || "")
    .replace(/^www\./, "")
    .toLowerCase();
  if (!h) return null;
  if (h.endsWith(".xxx") || h === "xxx") return h.endsWith(".xxx") ? h : "xxx";
  for (const d of ADULT_SITES) {
    if (h === d || h.endsWith("." + d)) return d;
  }
  return null;
}

function _isGoogleHost(h) {
  return h === "google.com" || /^google\.[a-z.]+$/.test(h) || /(^|\.)google\.[a-z.]+$/.test(h);
}

/**
 * True when a search URL's q= (etc.) contains a high-precision adult term.
 * @param {string} url
 */
function isAdultSearchUrl(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = (u.pathname || "/").toLowerCase();
    let q = "";
    if (_isGoogleHost(h) && (path === "/search" || path.startsWith("/search"))) {
      q = u.searchParams.get("q") || "";
    } else if ((h === "bing.com" || h.endsWith(".bing.com")) && path.startsWith("/search")) {
      q = u.searchParams.get("q") || "";
    } else if (h === "duckduckgo.com") {
      q = u.searchParams.get("q") || "";
    } else {
      return false;
    }
    const tokens = String(q)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    return tokens.some((t) => ADULT_SEARCH_TERMS.has(t));
  } catch {
    return false;
  }
}

/**
 * Curated reddit NSFW path: /r/porn etc. — not all of reddit.
 * @param {string} url
 */
function isAdultRedditPath(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (h !== "reddit.com" && !h.endsWith(".reddit.com") && h !== "redd.it") return false;
    const m = (u.pathname || "").toLowerCase().match(/^\/r\/([a-z0-9_]+)/);
    return !!(m && ADULT_REDDIT_SUBS.has(m[1]));
  } catch {
    return false;
  }
}

/**
 * Adult navigation hit for "Back to work?" prompts.
 * @param {string} url
 * @returns {{ domain: string, kind: 'site'|'search'|'reddit' } | null}
 */
function matchAdultHit(url) {
  if (!url || !/^https?:/i.test(url)) return null;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;

  const apex = matchAdultDomain(host);
  if (apex) return { domain: apex, kind: "site" };

  if (isAdultSearchUrl(url)) {
    const key = _isGoogleHost(host) ? "google-search" : host.split(".").slice(-2).join(".") || host;
    return { domain: key, kind: "search" };
  }

  if (isAdultRedditPath(url)) {
    return { domain: "reddit.com", kind: "reddit" };
  }

  return null;
}

const WORK = new Set([
  "github.com",
  "githubusercontent.com",
  "gist.github.com",
  "raw.githubusercontent.com",
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
