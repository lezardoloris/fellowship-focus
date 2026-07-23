/* Fellowship Focus — MV3 background service worker.
   Blocks distracting sites via declarativeNetRequest, runs focus sessions,
   syncs the block list from the web app, and logs blocks/sessions to the guild. */

importScripts("history.js");

const DEFAULT_SITES = [
  "x.com", "twitter.com", "facebook.com", "instagram.com", "reddit.com",
  "tiktok.com", "youtube.com", "netflix.com", "twitch.tv",
];

/** Hard-mode auto-hosts — parity with desktop HARD_HOSTS_OPTIONAL. */
const HARD_HOSTS_OPTIONAL = [
  "youtube.com",
  "youtu.be",
  "m.youtube.com",
  "music.youtube.com",
  "instagram.com",
  "linkedin.com",
];

/** Origins allowed for externally_connectable messages (exact prod + local). */
const TRUSTED_ORIGINS = new Set([
  "https://fellowship-focus-production.up.railway.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://localhost:3000",
  "http://localhost",
  "http://127.0.0.1",
]);

function isTrustedOrigin(origin) {
  if (!origin) return false;
  if (TRUSTED_ORIGINS.has(origin)) return true;
  // Allow any localhost / 127.0.0.1 port in development.
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Config safe to echo to UI / external callers — never include the bearer. */
function publicConfig(cfg) {
  const { token: _t, ...rest } = cfg || {};
  return { ...rest, token: cfg?.token ? true : false };
}

const DEFAULTS = {
  apiUrl: "",
  token: "",
  code: "",
  name: "",
  deviceId: "",
  manualShield: false,
  // True while the desktop app's system-wide proxy shield is detected. Makes
  // the extension's tab-level enforcement follow the desktop automatically.
  desktopShieldOn: false,
  sites: DEFAULT_SITES.slice(),
  prefs: {
    focus_min: 50,
    break_min: 10,
    cycles: 3,
    hard_mode: "confirm",
    hard_delay_secs: 30,
    hard_phrase: "i will focus",
    allowlist: ["github.com", "githubusercontent.com", "docs.google.com", "stackoverflow.com", "notion.so"],
    schedules: [],
    quick_lock_until: null,
    site_modes: {},
    friction_secs: 8,
    // How a blocked hit is enforced:
    //  "page"   — full block page (default)
    //  "notify" — bounce the tab back + a brief "-N XP" notification
    block_style: "page",
    // soft = list only; hard = also auto-add HARD_HOSTS_OPTIONAL
    blocker_mode: "hard",
  },
  focus: null, // { phase, cycle, endsAt, paused?, remainingMs?, webOwnsLog? }
  stats: { date: today(), blocks: 0, focusMinutes: 0 },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function getConfig() {
  const { config } = await chrome.storage.local.get("config");
  const merged = { ...DEFAULTS, ...(config || {}) };
  merged.prefs = { ...DEFAULTS.prefs, ...(config?.prefs || {}) };
  merged.stats = { ...DEFAULTS.stats, ...(config?.stats || {}) };
  if (merged.stats.date !== today()) merged.stats = { date: today(), blocks: 0, focusMinutes: 0 };
  return merged;
}

async function setConfig(patch) {
  const current = await getConfig();
  const next = { ...current, ...patch };
  if (patch.prefs) next.prefs = { ...current.prefs, ...patch.prefs };
  await chrome.storage.local.set({ config: next });
  return next;
}

function scheduleForcesOn(prefs) {
  const now = new Date();
  if (prefs.quick_lock_until) {
    const until = new Date(prefs.quick_lock_until).getTime();
    if (until > now.getTime()) return { on: true, locked: true };
  }
  const day = now.getDay();
  const hm =
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0");
  for (const rule of prefs.schedules || []) {
    if (!(rule.days || []).includes(day)) continue;
    if (rule.start <= hm && hm < rule.end) return { on: true, locked: !!rule.locked };
  }
  return { on: false, locked: false };
}

function effectiveShield(cfg) {
  const sched = scheduleForcesOn(cfg.prefs || {});
  return cfg.manualShield || !!cfg.focus || sched.on || !!cfg.desktopShieldOn;
}

function isAllowlisted(domain, allowlist) {
  const d = String(domain || "").toLowerCase();
  return (allowlist || []).some((a) => d === a || d.endsWith("." + a));
}

// ── declarativeNetRequest rules ─────────────────────────

// Sites that live on more than one apex domain. Blocking the obvious name
// without these leaves an open door (youtu.be links bypass a youtube.com rule).
const DOMAIN_ALIASES = {
  "youtube.com": ["youtu.be", "youtube-nocookie.com", "m.youtube.com", "music.youtube.com"],
  "twitter.com": ["x.com", "t.co"],
  "x.com": ["twitter.com", "t.co"],
  "facebook.com": ["fb.com", "fb.watch"],
  "instagram.com": ["ig.me"],
  "reddit.com": ["redd.it"],
  "tiktok.com": ["vm.tiktok.com"],
};

/** Expand a site into every domain that must be blocked with it. */
function expandDomains(site) {
  const base = normalizeSite(site);
  if (!base) return [];
  return [base, ...(DOMAIN_ALIASES[base] || [])];
}

function ruleForDomain(domain, id, friction) {
  return {
    id,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath:
          (friction ? "/friction.html?d=" : "/block.html?d=") + encodeURIComponent(domain),
      },
    },
    condition: {
      // requestDomains matches the apex AND every subdomain (www., m., old.…),
      // which urlFilter "||domain^" does not do reliably for main_frame.
      requestDomains: [domain],
      resourceTypes: ["main_frame"],
    },
  };
}

// Soft-mode path extras used to REPLACE full-domain rules for YouTube etc.,
 // which meant adding youtube.com to the list still left /watch reachable.
 // Listed sites are always full-domain blocked. Soft vs hard only controls
 // whether optional feed hosts are auto-added (desktop) — the list wins.
const SOFT_PATH_RULES = {
  "youtube.com": ["/shorts", "/feed/trending"],
  "instagram.com": ["/reels", "/explore", "/stories"],
  "facebook.com": ["/reel", "/watch", "/marketplace"],
  "tiktok.com": ["/foryou"],
  "linkedin.com": ["/feed"],
  "reddit.com": ["/r/popular", "/r/all"],
};

function ruleForPath(domain, path, id, friction) {
  return {
    id,
    priority: 2,
    action: {
      type: "redirect",
      redirect: {
        extensionPath:
          (friction ? "/friction.html?d=" : "/block.html?d=") +
          encodeURIComponent(domain + path),
      },
    },
    condition: {
      requestDomains: [domain],
      urlFilter: path,
      resourceTypes: ["main_frame"],
    },
  };
}

/** Higher-priority allow rule so a friction "Continue" isn't re-blocked instantly. */
function tempAllowRule(domain, id) {
  return {
    id,
    priority: 100,
    action: { type: "allow" },
    condition: { requestDomains: [domain], resourceTypes: ["main_frame"] },
  };
}

const TEMP_ALLOW_ID_BASE = 900000;

/** Drop expired entries from prefs.temp_allow ({domain: epochMs}). */
function liveTempAllows(cfg) {
  const raw = (cfg.prefs && cfg.prefs.temp_allow) || {};
  const now = Date.now();
  const out = {};
  for (const [domain, until] of Object.entries(raw)) {
    if (Number(until) > now) out[domain] = Number(until);
  }
  return out;
}

/** Would this URL be blocked right now? Mirrors the DNR rules exactly, so the
 * tab sweep and the DNR engine can never disagree. */
function blockDecision(urlString, cfg) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const allow = cfg.prefs.allowlist || [];
  if (isAllowlisted(host, allow)) return null;
  const soft = (cfg.prefs || {}).blocker_mode === "soft";
  const modes = cfg.prefs.site_modes || {};

  for (const site of (cfg.sites || []).filter(Boolean)) {
    const base = normalizeSite(site);
    if (!base) continue;
    const friction = modes[base] === "friction";
    // Listed sites always full-domain block (aliases included). Soft mode used
    // to path-only YouTube here and left watch pages open — that felt broken.
    for (const domain of expandDomains(site)) {
      if (host === domain || host.endsWith("." + domain)) {
        return { domain, friction };
      }
    }
  }
  // Hard mode: also match HARD_HOSTS_OPTIONAL even when not on the user list.
  if (!soft) {
    for (const site of HARD_HOSTS_OPTIONAL) {
      for (const domain of expandDomains(site)) {
        if (host === domain || host.endsWith("." + domain)) {
          return { domain, friction: false };
        }
      }
    }
  }
  // Soft extras: if a feed host isn't full-listed, still catch doomscroll paths.
  if (soft) {
    for (const [base, paths] of Object.entries(SOFT_PATH_RULES)) {
      if (!(host === base || host.endsWith("." + base))) continue;
      const path = u.pathname.toLowerCase();
      for (const p of paths) {
        if (path === p || path.startsWith(p + "/") || path.startsWith(p + "?")) {
          return { domain: base + p, friction: false };
        }
      }
    }
  }
  return null;
}

/** Redirect every already-open tab that matches the block list.
 * A proxy cannot reach into established connections; the extension can. This
 * is what makes arming instant even for tabs opened long before. */
async function sweepOpenTabs() {
  const cfg = await getConfig();
  if (!effectiveShield(cfg)) return 0;
  let swept = 0;
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      const hit = blockDecision(tab.url, cfg);
      if (!hit) continue;
      await enforceBlock(tab.id, tab.url, cfg, hit);
      swept += 1;
    }
  } catch (e) {
    /* tabs permission missing or transient — DNR still covers navigation */
  }
  if (swept) await chrome.storage.local.set({ lastSweep: { at: Date.now(), count: swept } });
  return swept;
}

/** Kill the service-worker/cache shell of blocked sites so nothing renders
 * from offline storage. Run on the off->on transition only (it is heavy). */
async function purgeBlockedOriginData(cfg) {
  try {
    const origins = [];
    for (const site of (cfg.sites || []).filter(Boolean).slice(0, 50)) {
      for (const domain of expandDomains(site)) {
        origins.push(`https://${domain}`, `https://www.${domain}`);
      }
    }
    if (!origins.length) return;
    await chrome.browsingData.remove(
      { origins: [...new Set(origins)].slice(0, 100) },
      { serviceWorkers: true, cacheStorage: true }
    );
  } catch (e) {
    /* browsingData can reject origins — never let it break arming */
  }
}

let _lastShieldOn = null;

async function rebuildRules() {
  const cfg = await getConfig();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  const allow = cfg.prefs.allowlist || [];
  const modes = cfg.prefs.site_modes || {};
  const temp = liveTempAllows(cfg);

  const soft = (cfg.prefs || {}).blocker_mode === "soft";
  const notifyOnly = (cfg.prefs || {}).block_style === "notify";

  // Effective site list: hard mode auto-adds HARD_HOSTS_OPTIONAL (desktop parity).
  const siteList = soft
    ? (cfg.sites || []).filter(Boolean)
    : [...new Set([...(cfg.sites || []).filter(Boolean), ...HARD_HOSTS_OPTIONAL])];

  let addRules = [];
  // Notify mode: do NOT install DNR redirects — tab sweep + webNavigation bounce instead.
  // That keeps "notify" honest (no full block page) and avoids double /api/blocks with block.js.
  if (effectiveShield(cfg) && !notifyOnly) {
    const seen = new Set();
    let id = 1;
    for (const site of siteList) {
      const base = normalizeSite(site);
      const friction = modes[base] === "friction";
      // Always install full-domain rules for listed sites (YouTube included).
      for (const domain of expandDomains(site)) {
        if (seen.has(domain)) continue;
        if (isAllowlisted(domain, allow)) continue;
        seen.add(domain);
        addRules.push(ruleForDomain(domain, id++, friction));
        if (id > 4000) break;
      }
      if (id > 4000) break;
    }
    // Soft mode: also block doomscroll paths on feed hosts that aren't listed.
    if (soft) {
      for (const [base, paths] of Object.entries(SOFT_PATH_RULES)) {
        if (seen.has(base) || isAllowlisted(base, allow)) continue;
        for (const path of paths) {
          addRules.push(ruleForPath(base, path, id++, false));
          if (id > 4000) break;
        }
        if (id > 4000) break;
      }
    }
    // Temporary allows win over block rules via priority.
    let allowId = TEMP_ALLOW_ID_BASE;
    for (const domain of Object.keys(temp)) {
      addRules.push(tempAllowRule(domain, allowId++));
    }
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  updateBadge(cfg);

  const shieldOn = effectiveShield(cfg);
  if (shieldOn) {
    // Existing tabs die the moment the shield rises — not on their next reload.
    await sweepOpenTabs();
    if (_lastShieldOn === false || _lastShieldOn === null) {
      await purgeBlockedOriginData(cfg);
    }
  }
  _lastShieldOn = shieldOn;
  // Prove enforcement after every rebuild — never leave a stale canary green.
  await runCanary(cfg);
  return addRules.length;
}

/**
 * Verified canary: Shield intent alone is not enough — prove enforcement is live.
 * Page mode: DNR rules installed (+ testMatchOutcome when Chrome supports it).
 * Notify mode: covered enforce list non-empty (no DNR redirects by design).
 */
async function runCanary(cfg) {
  const shieldOn = effectiveShield(cfg);
  if (!shieldOn) {
    await chrome.storage.local.set({ canaryOk: false, lastCanaryAt: Date.now() });
    return false;
  }
  const soft = (cfg.prefs || {}).blocker_mode === "soft";
  const notifyOnly = (cfg.prefs || {}).block_style === "notify";
  const siteList = soft
    ? (cfg.sites || []).filter(Boolean)
    : [...new Set([...(cfg.sites || []).filter(Boolean), ...HARD_HOSTS_OPTIONAL])];

  // Empty list + shield on = nothing to prove; treat as ready (honest idle arm).
  if (!siteList.length) {
    await chrome.storage.local.set({ canaryOk: true, lastCanaryAt: Date.now() });
    return true;
  }

  if (notifyOnly) {
    await chrome.storage.local.set({ canaryOk: true, lastCanaryAt: Date.now() });
    return true;
  }

  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const dnrCount = rules.filter((r) => r.id < TEMP_ALLOW_ID_BASE).length;
  let ok = dnrCount > 0;

  if (ok && chrome.declarativeNetRequest.testMatchOutcome) {
    try {
      const host = siteList[0];
      const result = await chrome.declarativeNetRequest.testMatchOutcome({
        url: `https://${host}/`,
        type: "main_frame",
      });
      const matched = result?.matchedRules;
      if (Array.isArray(matched)) ok = matched.length > 0;
      else if (matched && typeof matched === "object") ok = true;
    } catch {
      /* API flaky on some builds — fall back to rule count */
    }
  }

  await chrome.storage.local.set({ canaryOk: ok, lastCanaryAt: Date.now() });
  return ok;
}

async function healthTick() {
  const cfg = await getConfig();
  if (!effectiveShield(cfg)) {
    await chrome.storage.local.set({ canaryOk: false, lastCanaryAt: Date.now() });
    return;
  }
  let ok = await runCanary(cfg);
  if (!ok) {
    await rebuildRules();
    ok = await runCanary(await getConfig());
  }
  return ok;
}

/** Status the web app can trust — reflects real installed rules, not a ping. */
async function getStatus() {
  const cfg = await getConfig();
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const soft = (cfg.prefs || {}).blocker_mode === "soft";
  const notifyOnly = (cfg.prefs || {}).block_style === "notify";
  const siteList = soft
    ? (cfg.sites || []).filter(Boolean)
    : [...new Set([...(cfg.sites || []).filter(Boolean), ...HARD_HOSTS_OPTIONAL])];
  const dnrCount = rules.filter((r) => r.id < TEMP_ALLOW_ID_BASE).length;
  const stored = await chrome.storage.local.get(["canaryOk", "lastCanaryAt", "lastSweep"]);
  // ruleCount = real DNR rules only. Notify mode installs zero redirects; coveredSites
  // is the enforce list so UI can still treat shield as armed without faking DNR.
  return {
    ready: true,
    shieldOn: effectiveShield(cfg),
    manualShield: !!cfg.manualShield,
    focusOn: !!cfg.focus,
    siteCount: (cfg.sites || []).filter(Boolean).length,
    ruleCount: dnrCount,
    coveredSites: siteList.length,
    mode: soft ? "soft" : "hard",
    blockStyle: notifyOnly ? "notify" : "page",
    desktopShieldOn: !!cfg.desktopShieldOn,
    lastSweep: stored.lastSweep || null,
    canaryOk: typeof stored.canaryOk === "boolean" ? stored.canaryOk : null,
    lastCanaryAt: stored.lastCanaryAt || null,
    // Already collected every day and never shown — surface it.
    blocksToday: cfg.stats?.blocks || 0,
    focusMinutesToday: cfg.stats?.focusMinutes || 0,
    version: chrome.runtime.getManifest().version,
  };
}

function updateBadge(cfg) {
  const on = effectiveShield(cfg);
  chrome.action.setBadgeText({ text: on ? (cfg.focus ? "◕" : "on") : "" });
  chrome.action.setBadgeBackgroundColor({ color: cfg.focus ? "#b8422e" : "#2d6a4f" });
}

// ── Remote sync (web app is the source of truth when connected) ──

async function syncRemote() {
  const cfg = await getConfig();
  if (!cfg.apiUrl || !cfg.token) return cfg;
  try {
    const base = cfg.apiUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/blocker/config?token=${encodeURIComponent(cfg.token)}`);
    if (res.ok) {
      const json = await res.json();
      const patch = {};
      if (Array.isArray(json.sites) && json.sites.length) {
        patch.sites = json.sites.map((s) => s.site || s).filter(Boolean);
      }
      if (json.settings) {
        patch.prefs = { ...cfg.prefs, ...json.settings };
      }
      if (Object.keys(patch).length) await setConfig(patch);
    } else {
      // legacy fallback
      const [blRes, pfRes] = await Promise.all([
        fetch(`${base}/api/blocklist?token=${encodeURIComponent(cfg.token)}`),
        fetch(`${base}/api/prefs?token=${encodeURIComponent(cfg.token)}`),
      ]);
      const patch = {};
      if (blRes.ok) {
        const { sites } = await blRes.json();
        if (Array.isArray(sites) && sites.length) {
          patch.sites = sites.map((s) => s.site).filter(Boolean);
        }
      }
      if (pfRes.ok) {
        const { prefs } = await pfRes.json();
        if (prefs) patch.prefs = { ...cfg.prefs, focus_min: prefs.focus_min, break_min: prefs.break_min, cycles: prefs.cycles };
      }
      if (Object.keys(patch).length) await setConfig(patch);
    }

    // device heartbeat
    let deviceId = cfg.deviceId;
    const hb = await fetch(`${base}/api/blocker/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: cfg.token,
        action: "heartbeat",
        kind: "extension",
        label: "Chrome",
        shieldOn: effectiveShield(await getConfig()),
        deviceId: deviceId || undefined,
      }),
    });
    if (hb.ok) {
      const j = await hb.json();
      if (j.device?.id && j.device.id !== deviceId) {
        await setConfig({ deviceId: j.device.id });
      }
    }
  } catch (e) {
    /* offline — keep local list */
  }
  return getConfig();
}

// ── Focus sessions ───────────────────────────────────────

async function startFocus(opts = {}) {
  const cfg = await getConfig();
  const remainingMs =
    typeof opts.remainingMs === "number" && opts.remainingMs > 0
      ? opts.remainingMs
      : cfg.prefs.focus_min * 60000;
  const endsAt = Date.now() + remainingMs;
  const webOwnsLog = opts.webOwnsLog !== false; // web timer is primary logger by default
  await setConfig({
    focus: {
      phase: "focus",
      cycle: opts.cycle || 1,
      endsAt,
      paused: false,
      webOwnsLog,
    },
  });
  await chrome.alarms.create("focus", { when: endsAt });
  await rebuildRules();
}

async function pauseFocus() {
  const cfg = await getConfig();
  if (!cfg.focus || cfg.focus.paused) return;
  await chrome.alarms.clear("focus");
  const remainingMs = Math.max(0, (cfg.focus.endsAt || 0) - Date.now());
  await setConfig({
    focus: { ...cfg.focus, paused: true, remainingMs, endsAt: Date.now() + remainingMs },
  });
}

async function resumeFocus() {
  const cfg = await getConfig();
  if (!cfg.focus || !cfg.focus.paused) return;
  const remainingMs = Math.max(
    0,
    typeof cfg.focus.remainingMs === "number"
      ? cfg.focus.remainingMs
      : (cfg.focus.endsAt || 0) - Date.now()
  );
  if (remainingMs <= 0) {
    await onFocusAlarm();
    return;
  }
  const endsAt = Date.now() + remainingMs;
  await setConfig({
    focus: { ...cfg.focus, paused: false, remainingMs: undefined, endsAt },
  });
  await chrome.alarms.create("focus", { when: endsAt });
}

async function stopFocus() {
  await chrome.alarms.clear("focus");
  await setConfig({ focus: null });
  await rebuildRules();
}

async function onFocusAlarm() {
  const cfg = await getConfig();
  if (!cfg.focus || cfg.focus.paused) return;
  const { phase, cycle, webOwnsLog } = cfg.focus;

  // Web owns the session clock — do not auto-advance (break prompt lives in the app).
  // Keep shield/focus state armed; web will start break, extend, or stop.
  if (webOwnsLog) {
    await chrome.alarms.clear("focus");
    if (phase === "focus") {
      notify("The hour ends", "Rest, or continue the quest?");
    } else {
      notify("Break ended", "Ready when you are — open Fellowship Focus.");
    }
    return;
  }

  if (phase === "focus") {
    await logSession(cfg);
    const mins = (await getConfig()).stats.focusMinutes + cfg.prefs.focus_min;
    await setConfig({ stats: { ...cfg.stats, focusMinutes: mins } });
    if (cycle >= cfg.prefs.cycles) {
      await stopFocus();
      notify("Focus complete", `${cfg.prefs.cycles} cycles done. Well fought.`);
      return;
    }
    const endsAt = Date.now() + cfg.prefs.break_min * 60000;
    await setConfig({ focus: { phase: "break", cycle, endsAt, webOwnsLog } });
    await chrome.alarms.create("focus", { when: endsAt });
    notify("Break", `${cfg.prefs.break_min} min. Sites stay blocked.`);
  } else {
    const endsAt = Date.now() + cfg.prefs.focus_min * 60000;
    await setConfig({ focus: { phase: "focus", cycle: cycle + 1, endsAt, webOwnsLog } });
    await chrome.alarms.create("focus", { when: endsAt });
    notify("Back to focus", `Cycle ${cycle + 1}/${cfg.prefs.cycles}.`);
  }
  await rebuildRules();
}

async function logSession(cfg) {
  if (!cfg.apiUrl || !cfg.token) return;
  try {
    await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, minutes: cfg.prefs.focus_min, completed: true }),
    });
  } catch (e) {
    /* ignore */
  }
}

// ── Block logging (called by the block page when shown) ──

async function reportBlock(domain) {
  const cfg = await getConfig();
  const stats = cfg.stats.date === today()
    ? { ...cfg.stats, blocks: cfg.stats.blocks + 1 }
    : { date: today(), blocks: 1, focusMinutes: 0 };
  await setConfig({ stats });
  if (cfg.apiUrl && cfg.token && domain) {
    try {
      await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/api/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cfg.token, site: domain }),
      });
    } catch (e) {
      /* ignore */
    }
  }
}

function notify(title, message) {
  // Notifications permission is optional; guard it.
  try {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title,
        message,
      });
    }
  } catch (e) {
    /* ignore */
  }
}

// ── Connect / list management ────────────────────────────

async function connect(payload) {
  let data = payload;
  if (typeof payload === "string") {
    data = JSON.parse(payload);
  }
  const patch = {
    apiUrl: (data.apiUrl || "").replace(/\/$/, ""),
    token: data.token || "",
    code: data.code || "",
    name: data.name || "",
  };
  if (data.prefs && typeof data.prefs === "object") {
    patch.prefs = data.prefs;
  }
  // Connecting IS the act of arming. Without this the shield stays off,
  // rebuildRules() installs zero rules, and nothing is ever blocked.
  if (data.shieldOn !== false) patch.manualShield = true;

  await setConfig(patch);
  await syncRemote();

  // Apply the pushed list AFTER syncRemote so the freshly-sent list wins
  // instead of being clobbered by a stale server copy.
  const sites = Array.isArray(data.sites) ? data.sites.map(normalizeSite).filter(Boolean) : [];
  if (sites.length) await setConfig({ sites });

  await rebuildRules();
  return getConfig();
}

/** Replace the whole list — used on every web-app mutation so rules stay live. */
async function setSites(list) {
  // Replace list only — never clear Shield. Empty list still rebuilds (user cleared);
  // callers must not pass [] when they meant "unchanged" (timer/music sync races).
  const sites = (Array.isArray(list) ? list : []).map(normalizeSite).filter(Boolean);
  await setConfig({ sites: [...new Set(sites)] });
  await rebuildRules();
  return getConfig();
}

/** Let a domain through for N seconds (friction "Continue"), then re-block. */
async function allowTemporarily(domain, secs) {
  const clean = normalizeSite(domain);
  if (!clean) return getConfig();
  const cfg = await getConfig();
  const until = Date.now() + Math.max(5, Number(secs) || 60) * 1000;
  const temp = { ...liveTempAllows(cfg) };
  for (const d of expandDomains(clean)) temp[d] = until;
  await setConfig({ prefs: { ...cfg.prefs, temp_allow: temp } });
  await rebuildRules();
  // Re-block as soon as the window closes.
  chrome.alarms.create("tempAllow", { when: until + 500 });
  return getConfig();
}

async function addSite(site) {
  const cfg = await getConfig();
  const clean = normalizeSite(site);
  if (!clean) return cfg;
  if (cfg.apiUrl && cfg.token) {
    try {
      const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/api/blocklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cfg.token, action: "add", sites: [clean], category: "custom" }),
      });
      if (res.ok) {
        const { sites } = await res.json();
        await setConfig({ sites: sites.map((s) => s.site) });
        await rebuildRules();
        return getConfig();
      }
    } catch (e) {
      /* fall through to local */
    }
  }
  if (!cfg.sites.includes(clean)) {
    await setConfig({ sites: [...cfg.sites, clean] });
    await rebuildRules();
  }
  return getConfig();
}

async function removeSite(site) {
  const cfg = await getConfig();
  const clean = normalizeSite(site);
  if (cfg.apiUrl && cfg.token) {
    try {
      const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/api/blocklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cfg.token, action: "remove", site: clean }),
      });
      if (res.ok) {
        const { sites } = await res.json();
        await setConfig({ sites: sites.map((s) => s.site) });
        await rebuildRules();
        return getConfig();
      }
    } catch (e) {
      /* fall through */
    }
  }
  await setConfig({ sites: cfg.sites.filter((s) => s !== clean) });
  await rebuildRules();
  return getConfig();
}

function normalizeSite(site) {
  return String(site || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .slice(0, 120);
}

// ── Wiring ───────────────────────────────────────────────

// ── Desktop shield auto-detection ────────────────────────
// http://check.fellowshipfocus.internal/ only resolves through the desktop
// app's local proxy. If it answers, the system-wide shield is up — so the
// extension arms its tab-level enforcement with zero clicks.

let _probeBusy = false;

async function probeDesktopShield() {
  if (_probeBusy) return;
  _probeBusy = true;
  try {
    let up = false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    try {
      const r = await fetch("http://check.fellowshipfocus.internal/", {
        signal: ctl.signal,
        cache: "no-store",
      });
      up = r.ok;
    } catch {
      up = false;
    }
    clearTimeout(timer);
    const cfg = await getConfig();
    if (Boolean(cfg.desktopShieldOn) !== up) {
      await setConfig({ desktopShieldOn: up });
      await rebuildRules();
    }
  } finally {
    _probeBusy = false;
  }
}

// ── Instant kill on tab activation ───────────────────────

/** Enforce a block on one tab, honoring the configured style. */
async function enforceBlock(tabId, url, cfg, hit) {
  const style = (cfg.prefs || {}).block_style === "notify" ? "notify" : "page";

  if (style === "notify" && !hit.friction) {
    // Bounce off the site instead of showing the full page, then a brief toast.
    try {
      const tab = await chrome.tabs.get(tabId);
      // A brand-new tab has no history to go back to; close or blank it.
      if (tab && tab.url && /^https?:/.test(tab.url)) {
        chrome.tabs.goBack(tabId, () => {
          if (chrome.runtime.lastError) {
            chrome.tabs.update(tabId, { url: "about:blank" }, () => void chrome.runtime.lastError);
          }
        });
      } else {
        chrome.tabs.update(tabId, { url: "about:blank" }, () => void chrome.runtime.lastError);
      }
    } catch {
      /* tab gone */
    }
    notifyBlocked(hit.domain);
    return;
  }

  const page = (hit.friction ? "/friction.html?d=" : "/block.html?d=") +
    encodeURIComponent(hit.domain);
  chrome.tabs.update(tabId, { url: chrome.runtime.getURL(page) }, () => void chrome.runtime.lastError);
}

/** Small "-N XP" toast for notify mode; pulls the real penalty from the guild.
 * This is the SINGLE penalty writer for notify hits (DNR redirects are off). */
async function notifyBlocked(domain) {
  // Debounce duplicate navigations within 4s for the same domain.
  const key = String(domain || "").toLowerCase();
  const now = Date.now();
  if (!_notifyDebounce) _notifyDebounce = new Map();
  const prev = _notifyDebounce.get(key) || 0;
  if (now - prev < 4000) return;
  _notifyDebounce.set(key, now);

  let penalty = 10;
  try {
    const cfg = await getConfig();
    // Local stats only once here — do not also call reportBlock (would double-count).
    const stats =
      cfg.stats.date === today()
        ? { ...cfg.stats, blocks: cfg.stats.blocks + 1 }
        : { date: today(), blocks: 1, focusMinutes: 0 };
    await setConfig({ stats });
    if (cfg.apiUrl && cfg.token) {
      const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/api/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cfg.token, site: domain }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.penalty) penalty = j.penalty;
      }
    }
  } catch {
    /* offline — default penalty */
  }
  try {
    chrome.notifications.create(`ff-block-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: `${domain} blocked`,
      message: `−${penalty} XP · back to focus`,
      priority: 0,
    });
  } catch {
    /* notifications permission missing */
  }
}

let _notifyDebounce = null;

// ── Soft "Back to work?" productivity nudges ──
// During an active shield, visiting a known distractor / adult destination that
// is NOT already blocked → discreet in-page toast (nudge.js) with notification
// fallback. Adult takes priority (search/reddit heuristics). Desktop mitm owns
// the prompt while the system shield is detected (avoids double toast).

const DOPAMINE_PROMPT_PREFIX = "ff-dopamine-";
const ADULT_PROMPT_PREFIX = "ff-adult-";
const FOCUS_SNOOZE_MS = 5 * 60 * 1000; // "Snooze 5m"
const FOCUS_DISMISS_MS = 15 * 60 * 1000; // dismiss / keep browsing
const DESKTOP_ADD_SITE_URL = "http://add.fellowshipfocus.internal/";
/** @type {Map<string, { tabId?: number, at: number, category: string, kind: string, via?: string }>} */
const _focusNudgePending = new Map();

function dopamineNotifId(domain) {
  return DOPAMINE_PROMPT_PREFIX + domain;
}

function adultNotifId(domain) {
  return ADULT_PROMPT_PREFIX + domain;
}

function focusNotifId(category, domain) {
  return category === "adult" ? adultNotifId(domain) : dopamineNotifId(domain);
}

function isSoftPromptSkipHost(host) {
  const h = String(host || "").toLowerCase();
  if (!h) return true;
  if (h.includes("fellowship-focus")) return true;
  if (h.endsWith(".fellowshipfocus.internal") || h === "fellowshipfocus.internal") return true;
  return false;
}

async function getSoftSnoozeMap(category) {
  const key = category === "adult" ? "adultSnooze" : "dopamineSnooze";
  const bag = await chrome.storage.local.get(key);
  const map = bag[key];
  return map && typeof map === "object" ? map : {};
}

async function snoozeSoftPrompt(domain, category, ms = FOCUS_SNOOZE_MS) {
  const key = category === "adult" ? "adultSnooze" : "dopamineSnooze";
  const map = await getSoftSnoozeMap(category);
  const now = Date.now();
  for (const [k, until] of Object.entries(map)) {
    if (Number(until) <= now) delete map[k];
  }
  map[domain] = now + Math.max(60_000, Number(ms) || FOCUS_SNOOZE_MS);
  await chrome.storage.local.set({ [key]: map });
}

/** Ask the desktop proxy (if up) to add a site to the system blocklist. */
async function syncAddToDesktop(domain) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    await fetch(`${DESKTOP_ADD_SITE_URL}?site=${encodeURIComponent(domain)}`, {
      signal: ctl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
  } catch {
    /* desktop not proxying — extension-local add is enough */
  }
}

function _siteAlreadyListed(domain, host, cfg) {
  for (const site of cfg.sites || []) {
    const base = normalizeSite(site);
    if (!base) continue;
    for (const d of expandDomains(base)) {
      if (domain === d || host === d || host.endsWith("." + d)) return true;
    }
  }
  return false;
}

async function clearFocusNudgeUi(domain, category) {
  const pending = _focusNudgePending.get(domain);
  _focusNudgePending.delete(domain);
  try {
    chrome.notifications.clear(focusNotifId(category, domain));
  } catch {
    /* ignore */
  }
  if (pending?.via === "page" && typeof pending.tabId === "number") {
    try {
      await chrome.tabs.sendMessage(pending.tabId, { type: "FF_FOCUS_NUDGE_HIDE" });
    } catch {
      /* tab gone / no receiver */
    }
  }
}

async function acceptFocusNudge(domain, category) {
  const pending = _focusNudgePending.get(domain);
  const kind = pending?.kind || "site";
  const tabId = pending?.tabId;
  const cat = category || pending?.category || "distract";
  await clearFocusNudgeUi(domain, cat);

  // Search SERPs: don't block google — close the tab and return to focus.
  if (kind === "search") {
    if (typeof tabId === "number") {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        /* tab may already be gone */
      }
    }
    notify("Back to work", "Tab closed — the quest continues");
    return;
  }

  await addSite(domain);
  await syncAddToDesktop(domain);
  if (cat === "adult") {
    // Keep Shield armed after focus ends so the new site stays enforced.
    await setConfig({ manualShield: true });
    await rebuildRules();
  }
  notify("Blocked", `${domain} added to your blocklist`);
  if (cat === "adult" && typeof tabId === "number") {
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      /* tab may already be gone */
    }
  }
}

async function declineFocusNudge(domain, category, ms = FOCUS_SNOOZE_MS) {
  const pending = _focusNudgePending.get(domain);
  const cat = category || pending?.category || "distract";
  await clearFocusNudgeUi(domain, cat);
  await snoozeSoftPrompt(domain, cat, ms);
}

/** Prefer in-page toast; fall back to Chrome notification. */
async function showFocusNudge({ domain, tabId, kind, category }) {
  const cat = category === "adult" ? "adult" : "distract";
  const k = kind || "site";
  _focusNudgePending.set(domain, { tabId, at: Date.now(), category: cat, kind: k });

  if (typeof tabId === "number") {
    try {
      const res = await chrome.tabs.sendMessage(tabId, {
        type: "FF_FOCUS_NUDGE",
        domain,
        kind: k,
        category: cat,
      });
      if (res && res.ok) {
        _focusNudgePending.set(domain, {
          tabId,
          at: Date.now(),
          category: cat,
          kind: k,
          via: "page",
        });
        return;
      }
    } catch {
      /* no content script — notification fallback */
    }
  }

  const id = focusNotifId(cat, domain);
  const blockLabel = k === "search" ? "Close tab" : "Block site";
  const base = {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Back to work?",
    priority: 2,
    requireInteraction: true,
  };
  try {
    await chrome.notifications.create(id, {
      ...base,
      message: "This won't help the quest.",
      buttons: [{ title: blockLabel }, { title: "Snooze 5m" }],
    });
    _focusNudgePending.set(domain, {
      tabId,
      at: Date.now(),
      category: cat,
      kind: k,
      via: "notif",
    });
  } catch {
    try {
      await chrome.notifications.create(id, {
        ...base,
        message: "This won't help the quest. Click to leave · dismiss to keep browsing",
      });
      _focusNudgePending.set(domain, {
        tabId,
        at: Date.now(),
        category: cat,
        kind: k,
        via: "notif",
      });
    } catch {
      _focusNudgePending.delete(domain);
    }
  }
}

/**
 * Adult / porn navigation during shield → "Back to work?" nudge.
 * @returns {Promise<boolean>} true if handled (shown or snoozed)
 */
async function maybePromptAdult(url, tabId, cfg) {
  if (!url || !/^https?:/i.test(url)) return false;
  if (cfg.desktopShieldOn) return false;

  const hit = typeof matchAdultHit === "function" ? matchAdultHit(url) : null;
  if (!hit) return false;

  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return false;
  }
  if (!host || isSoftPromptSkipHost(host)) return false;
  if (isAllowlisted(host, cfg.prefs.allowlist || [])) return false;

  const { domain, kind } = hit;
  const temp = liveTempAllows(cfg);
  if (temp[host] || temp[domain]) return false;

  // Already listed adult apex — blockDecision should have handled (except search).
  if (kind === "site" && _siteAlreadyListed(domain, host, cfg)) return false;

  const snooze = await getSoftSnoozeMap("adult");
  if ((snooze[domain] || 0) > Date.now()) return true;

  const pending = _focusNudgePending.get(domain);
  if (pending && Date.now() - pending.at < 5 * 60 * 1000) return true;

  await showFocusNudge({ domain, tabId, kind, category: "adult" });
  return true;
}

/** Unblocked curated distractor → same "Back to work?" nudge. */
async function maybePromptDopamine(url, tabId, cfg) {
  if (!url || !/^https?:/i.test(url)) return;
  if (cfg.desktopShieldOn) return;

  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return;
  }
  if (!host || isSoftPromptSkipHost(host)) return;
  if (isAllowlisted(host, cfg.prefs.allowlist || [])) return;

  const domain = matchDopamineDomain(host, DOMAIN_ALIASES);
  if (!domain) return;

  const temp = liveTempAllows(cfg);
  if (temp[host] || temp[domain]) return;

  if (_siteAlreadyListed(domain, host, cfg)) return;

  const snooze = await getSoftSnoozeMap("distract");
  if ((snooze[domain] || 0) > Date.now()) return;

  const pending = _focusNudgePending.get(domain);
  if (pending && Date.now() - pending.at < 5 * 60 * 1000) return;

  await showFocusNudge({ domain, tabId, kind: "site", category: "distract" });
}

/** Soft prompts after an unblocked navigation — adult first, then distractors. */
async function maybePromptSoft(url, tabId, cfg) {
  if (await maybePromptAdult(url, tabId, cfg)) return;
  await maybePromptDopamine(url, tabId, cfg);
}

if (chrome.notifications) {
  chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
    if (id.startsWith(ADULT_PROMPT_PREFIX)) {
      const domain = id.slice(ADULT_PROMPT_PREFIX.length);
      if (buttonIndex === 0) void acceptFocusNudge(domain, "adult");
      else void declineFocusNudge(domain, "adult", FOCUS_SNOOZE_MS);
      return;
    }
    if (!id.startsWith(DOPAMINE_PROMPT_PREFIX)) return;
    const domain = id.slice(DOPAMINE_PROMPT_PREFIX.length);
    if (buttonIndex === 0) void acceptFocusNudge(domain, "distract");
    else void declineFocusNudge(domain, "distract", FOCUS_SNOOZE_MS);
  });
  chrome.notifications.onClicked.addListener((id) => {
    if (id.startsWith(ADULT_PROMPT_PREFIX)) {
      void acceptFocusNudge(id.slice(ADULT_PROMPT_PREFIX.length), "adult");
      return;
    }
    if (!id.startsWith(DOPAMINE_PROMPT_PREFIX)) return;
    void acceptFocusNudge(id.slice(DOPAMINE_PROMPT_PREFIX.length), "distract");
  });
  chrome.notifications.onClosed.addListener((id, byUser) => {
    if (id.startsWith(ADULT_PROMPT_PREFIX)) {
      const domain = id.slice(ADULT_PROMPT_PREFIX.length);
      if (!_focusNudgePending.has(domain)) return;
      void declineFocusNudge(
        domain,
        "adult",
        byUser ? FOCUS_DISMISS_MS : FOCUS_SNOOZE_MS,
      );
      return;
    }
    if (!id.startsWith(DOPAMINE_PROMPT_PREFIX)) return;
    const domain = id.slice(DOPAMINE_PROMPT_PREFIX.length);
    if (!_focusNudgePending.has(domain)) return;
    void declineFocusNudge(
      domain,
      "distract",
      byUser ? FOCUS_DISMISS_MS : FOCUS_SNOOZE_MS,
    );
  });
}

async function checkActiveTab(tabId) {
  try {
    const cfg = await getConfig();
    if (!effectiveShield(cfg)) return;
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) return;
    const hit = blockDecision(tab.url, cfg);
    if (hit) await enforceBlock(tabId, tab.url, cfg, hit);
    else await maybePromptSoft(tab.url, tabId, cfg);
  } catch {
    /* tab gone — nothing to do */
  }
}

// Instant kill the moment a navigation STARTS — before the page loads, as soon
// as you hit enter in the address bar. Soft nudges wait for onCompleted so the
// in-page toast content script is ready. historyStateUpdated covers SPA routes.
async function onTopFrameNavigate(details) {
  if (details.frameId !== 0) return; // top frame only
  try {
    const cfg = await getConfig();
    if (!effectiveShield(cfg)) return;
    const hit = blockDecision(details.url, cfg);
    if (hit) await enforceBlock(details.tabId, details.url, cfg, hit);
  } catch {
    /* ignore */
  }
}

async function onTopFrameCompleted(details) {
  if (details.frameId !== 0) return;
  try {
    const cfg = await getConfig();
    if (!effectiveShield(cfg)) return;
    const hit = blockDecision(details.url, cfg);
    if (!hit) await maybePromptSoft(details.url, details.tabId, cfg);
  } catch {
    /* ignore */
  }
}

async function onHistoryStateUpdated(details) {
  if (details.frameId !== 0) return;
  try {
    const cfg = await getConfig();
    if (!effectiveShield(cfg)) return;
    const hit = blockDecision(details.url, cfg);
    if (hit) await enforceBlock(details.tabId, details.url, cfg, hit);
    else await maybePromptSoft(details.url, details.tabId, cfg);
  } catch {
    /* ignore */
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(onTopFrameNavigate);
chrome.webNavigation.onCompleted.addListener(onTopFrameCompleted);
chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated);

chrome.tabs.onActivated.addListener((info) => {
  probeDesktopShield();
  checkActiveTab(info.tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab?.id) checkActiveTab(tab.id);
  } catch {
    /* window gone */
  }
});

function createAlarms() {
  chrome.alarms.create("sync", { periodInMinutes: 15 });
  chrome.alarms.create("scheduleTick", { periodInMinutes: 1 });
  chrome.alarms.create("desktopProbe", { periodInMinutes: 0.5 });
  // Continuous health: SW alive + DNR/canary coherence while shield claims ON.
  chrome.alarms.create("health", { periodInMinutes: 2 });
}

chrome.runtime.onInstalled.addListener(async () => {
  await getConfig();
  await probeDesktopShield();
  await rebuildRules();
  createAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await probeDesktopShield();
  await rebuildRules();
  createAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "focus") await onFocusAlarm();
  else if (alarm.name === "sync") {
    await syncRemote();
    await rebuildRules();
  } else if (alarm.name === "scheduleTick" || alarm.name === "tempAllow") {
    await rebuildRules();
  } else if (alarm.name === "desktopProbe") {
    await probeDesktopShield();
  } else if (alarm.name === "health") {
    await healthTick();
  }
});

function handleMessage(msg, sendResponse, sender) {
  (async () => {
    switch (msg?.type) {
      case "getState":
        sendResponse({ config: publicConfig(await getConfig()), status: await getStatus() });
        break;
      case "getStatus":
        sendResponse({ status: await getStatus() });
        break;
      case "setSites":
        await setSites(msg.sites);
        sendResponse({ config: publicConfig(await getConfig()), status: await getStatus() });
        break;
      case "allowTemporarily":
        await allowTemporarily(msg.domain, msg.secs);
        sendResponse({ ok: true });
        break;
      case "setShield": {
        const cfg = await getConfig();
        const sched = scheduleForcesOn(cfg.prefs || {});
        if (!msg.on && (cfg.focus || sched.locked)) {
          sendResponse({ config: publicConfig(cfg), error: "locked" });
          break;
        }
        await setConfig({ manualShield: !!msg.on });
        await rebuildRules();
        sendResponse({ config: publicConfig(await getConfig()), status: await getStatus() });
        break;
      }
      case "startFocus":
        await startFocus({
          remainingMs: msg.remainingMs,
          cycle: msg.cycle,
          webOwnsLog: msg.webOwnsLog !== false,
        });
        sendResponse({ config: publicConfig(await getConfig()), status: await getStatus(), ok: true });
        break;
      case "pauseFocus":
        await pauseFocus();
        sendResponse({ config: publicConfig(await getConfig()), status: await getStatus(), ok: true });
        break;
      case "resumeFocus":
        await resumeFocus();
        sendResponse({ config: publicConfig(await getConfig()), status: await getStatus(), ok: true });
        break;
      case "stopFocus":
        await stopFocus();
        sendResponse({ config: publicConfig(await getConfig()), status: await getStatus(), ok: true });
        break;
      case "connect":
        sendResponse({
          config: publicConfig(await connect(msg.payload)),
          status: await getStatus(),
          ok: true,
        });
        break;
      case "pairFromCode": {
        try {
          const base = (msg.apiUrl || "").replace(/\/$/, "") || "https://fellowship-focus-production.up.railway.app";
          const res = await fetch(`${base}/api/blocker/pair?code=${encodeURIComponent(msg.code)}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "pair_failed");
          sendResponse({
            config: publicConfig(await connect(json)),
            status: await getStatus(),
            ok: true,
          });
        } catch (e) {
          sendResponse({ error: String(e) });
        }
        break;
      }
      case "disconnect":
        await setConfig({ apiUrl: "", token: "", code: "", name: "" });
        sendResponse({ config: publicConfig(await getConfig()) });
        break;
      case "addSite":
        sendResponse({ config: publicConfig(await addSite(msg.site)) });
        break;
      case "removeSite":
        sendResponse({ config: publicConfig(await removeSite(msg.site)) });
        break;
      case "refresh":
        await syncRemote();
        await rebuildRules();
        sendResponse({ config: publicConfig(await getConfig()), ok: true });
        break;
      case "reportBlock":
        await reportBlock(msg.domain);
        sendResponse({ ok: true });
        break;
      case "analyzeHistory": {
        // history is OPTIONAL (kept out of the base manifest for easier review).
        // chrome.permissions.request needs a direct user gesture, which a message
        // from the web app can't carry — so here we only CHECK. The grant happens
        // from the popup button. If not granted, tell the caller how to enable it.
        const has = await new Promise((res) => {
          try {
            chrome.permissions.contains({ permissions: ["history"] }, (ok) => res(!!ok));
          } catch {
            res(false);
          }
        });
        if (!has) {
          sendResponse({ error: "history_permission_needed", suggestions: [] });
          break;
        }
        const suggestions = await analyzeHistory(msg.days || 30);
        await chrome.storage.local.set({ historySuggestions: suggestions });
        const push = await pushSuggestions(suggestions);
        sendResponse({ suggestions, push });
        break;
      }
      case "requestHistoryPermission": {
        // Called from the popup (direct user gesture) — safe to request here.
        const ok = await new Promise((res) => {
          try {
            chrome.permissions.request({ permissions: ["history"] }, (g) => res(!!g));
          } catch {
            res(false);
          }
        });
        sendResponse({ granted: ok });
        break;
      }
      case "getHistorySuggestions": {
        const { historySuggestions } = await chrome.storage.local.get("historySuggestions");
        sendResponse({ suggestions: historySuggestions || [] });
        break;
      }
      case "getPrefs":
        sendResponse({ prefs: (await getConfig()).prefs });
        break;
      case "focusNudgeAction": {
        const domain = String(msg.domain || "").trim().toLowerCase();
        const category = msg.category === "adult" ? "adult" : "distract";
        const action = String(msg.action || "");
        if (!domain) {
          sendResponse({ error: "no_domain" });
          break;
        }
        let pending = _focusNudgePending.get(domain);
        if (!pending) {
          pending = {
            tabId: sender?.tab?.id,
            kind: msg.kind || "site",
            category,
            at: Date.now(),
            via: "page",
          };
          _focusNudgePending.set(domain, pending);
        } else {
          if (msg.kind) pending.kind = String(msg.kind);
          if (typeof pending.tabId !== "number" && sender?.tab?.id) {
            pending.tabId = sender.tab.id;
          }
        }
        if (action === "block") await acceptFocusNudge(domain, category);
        else if (action === "snooze") await declineFocusNudge(domain, category, FOCUS_SNOOZE_MS);
        else if (action === "dismiss") await declineFocusNudge(domain, category, FOCUS_DISMISS_MS);
        else {
          sendResponse({ error: "unknown_action" });
          break;
        }
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ error: "unknown" });
    }
  })();
  return true; // async
}

// Internal messages (popup, block page, content script).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) =>
  handleMessage(msg, sendResponse, sender)
);

// Direct messages from the web app (externally_connectable). More robust than
// the content-script relay: works even if the content script didn't inject.
if (chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    if (!isTrustedOrigin(sender.origin)) {
      sendResponse({ error: "untrusted_origin" });
      return false;
    }
    return handleMessage(msg, sendResponse);
  });
}
