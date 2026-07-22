/* Fellowship Focus — MV3 background service worker.
   Blocks distracting sites via declarativeNetRequest, runs focus sessions,
   syncs the block list from the web app, and logs blocks/sessions to the guild. */

importScripts("history.js");

const DEFAULT_SITES = [
  "x.com", "twitter.com", "facebook.com", "instagram.com", "reddit.com",
  "tiktok.com", "youtube.com", "netflix.com", "twitch.tv",
];

const DEFAULTS = {
  apiUrl: "",
  token: "",
  code: "",
  name: "",
  deviceId: "",
  manualShield: false,
  sites: DEFAULT_SITES.slice(),
  prefs: {
    focus_min: 45,
    break_min: 5,
    cycles: 4,
    hard_mode: "confirm",
    hard_delay_secs: 30,
    hard_phrase: "i will focus",
    allowlist: ["github.com", "docs.google.com", "stackoverflow.com", "notion.so"],
    schedules: [],
    quick_lock_until: null,
    site_modes: {},
    friction_secs: 8,
  },
  focus: null, // { phase, cycle, endsAt }
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
  return cfg.manualShield || !!cfg.focus || sched.on;
}

function isAllowlisted(domain, allowlist) {
  const d = String(domain || "").toLowerCase();
  return (allowlist || []).some((a) => d === a || d.endsWith("." + a));
}

// ── declarativeNetRequest rules ─────────────────────────

// Sites that live on more than one apex domain. Blocking the obvious name
// without these leaves an open door (youtu.be links bypass a youtube.com rule).
const DOMAIN_ALIASES = {
  "youtube.com": ["youtu.be", "youtube-nocookie.com"],
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

async function rebuildRules() {
  const cfg = await getConfig();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  const allow = cfg.prefs.allowlist || [];
  const modes = cfg.prefs.site_modes || {};
  const temp = liveTempAllows(cfg);

  let addRules = [];
  if (effectiveShield(cfg)) {
    const seen = new Set();
    let id = 1;
    for (const site of cfg.sites.filter(Boolean)) {
      const friction = modes[normalizeSite(site)] === "friction";
      for (const domain of expandDomains(site)) {
        if (seen.has(domain)) continue;
        if (isAllowlisted(domain, allow)) continue;
        seen.add(domain);
        addRules.push(ruleForDomain(domain, id++, friction));
        if (id > 4000) break;
      }
      if (id > 4000) break;
    }
    // Temporary allows win over block rules via priority.
    let allowId = TEMP_ALLOW_ID_BASE;
    for (const domain of Object.keys(temp)) {
      addRules.push(tempAllowRule(domain, allowId++));
    }
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  updateBadge(cfg);
  return addRules.length;
}

/** Status the web app can trust — reflects real installed rules, not a ping. */
async function getStatus() {
  const cfg = await getConfig();
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return {
    ready: true,
    shieldOn: effectiveShield(cfg),
    manualShield: !!cfg.manualShield,
    focusOn: !!cfg.focus,
    siteCount: (cfg.sites || []).filter(Boolean).length,
    ruleCount: rules.filter((r) => r.id < TEMP_ALLOW_ID_BASE).length,
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

async function startFocus() {
  const cfg = await getConfig();
  const endsAt = Date.now() + cfg.prefs.focus_min * 60000;
  await setConfig({ focus: { phase: "focus", cycle: 1, endsAt } });
  await chrome.alarms.create("focus", { when: endsAt });
  await rebuildRules();
}

async function stopFocus() {
  await chrome.alarms.clear("focus");
  await setConfig({ focus: null });
  await rebuildRules();
}

async function onFocusAlarm() {
  const cfg = await getConfig();
  if (!cfg.focus) return;
  const { phase, cycle } = cfg.focus;

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
    await setConfig({ focus: { phase: "break", cycle, endsAt } });
    await chrome.alarms.create("focus", { when: endsAt });
    notify("Break", `${cfg.prefs.break_min} min. Sites stay blocked.`);
  } else {
    const endsAt = Date.now() + cfg.prefs.focus_min * 60000;
    await setConfig({ focus: { phase: "focus", cycle: cycle + 1, endsAt } });
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

chrome.runtime.onInstalled.addListener(async () => {
  await getConfig();
  await rebuildRules();
  chrome.alarms.create("sync", { periodInMinutes: 15 });
  chrome.alarms.create("scheduleTick", { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  await rebuildRules();
  chrome.alarms.create("sync", { periodInMinutes: 15 });
  chrome.alarms.create("scheduleTick", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "focus") await onFocusAlarm();
  else if (alarm.name === "sync") {
    await syncRemote();
    await rebuildRules();
  } else if (alarm.name === "scheduleTick" || alarm.name === "tempAllow") {
    await rebuildRules();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "getState":
        sendResponse({ config: await getConfig(), status: await getStatus() });
        break;
      case "getStatus":
        sendResponse({ status: await getStatus() });
        break;
      case "setSites":
        await setSites(msg.sites);
        sendResponse({ config: await getConfig(), status: await getStatus() });
        break;
      case "allowTemporarily":
        await allowTemporarily(msg.domain, msg.secs);
        sendResponse({ ok: true });
        break;
      case "setShield": {
        const cfg = await getConfig();
        const sched = scheduleForcesOn(cfg.prefs || {});
        if (!msg.on && (cfg.focus || sched.locked)) {
          sendResponse({ config: cfg, error: "locked" });
          break;
        }
        await setConfig({ manualShield: !!msg.on });
        await rebuildRules();
        sendResponse({ config: await getConfig(), status: await getStatus() });
        break;
      }
      case "startFocus":
        await startFocus();
        sendResponse({ config: await getConfig(), status: await getStatus() });
        break;
      case "stopFocus":
        await stopFocus();
        sendResponse({ config: await getConfig(), status: await getStatus() });
        break;
      case "connect":
        sendResponse({ config: await connect(msg.payload), status: await getStatus() });
        break;
      case "pairFromCode": {
        try {
          const base = (msg.apiUrl || "").replace(/\/$/, "") || "https://fellowship-focus-production.up.railway.app";
          const res = await fetch(`${base}/api/blocker/pair?code=${encodeURIComponent(msg.code)}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "pair_failed");
          sendResponse({ config: await connect(json), status: await getStatus() });
        } catch (e) {
          sendResponse({ error: String(e) });
        }
        break;
      }
      case "disconnect":
        await setConfig({ apiUrl: "", token: "", code: "", name: "" });
        sendResponse({ config: await getConfig() });
        break;
      case "addSite":
        sendResponse({ config: await addSite(msg.site) });
        break;
      case "removeSite":
        sendResponse({ config: await removeSite(msg.site) });
        break;
      case "refresh":
        await syncRemote();
        await rebuildRules();
        sendResponse({ config: await getConfig() });
        break;
      case "reportBlock":
        await reportBlock(msg.domain);
        sendResponse({ ok: true });
        break;
      case "analyzeHistory": {
        const suggestions = await analyzeHistory(msg.days || 30);
        await chrome.storage.local.set({ historySuggestions: suggestions });
        const push = await pushSuggestions(suggestions);
        sendResponse({ suggestions, push });
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
      default:
        sendResponse({ error: "unknown" });
    }
  })();
  return true; // async
});
