/**
 * [TRK-6] Time per site, measured where the URL actually is.
 *
 * The desktop tracker sees "chrome, 12.6h" and can go no further: the Windows
 * window title is "<page title> - Google Chrome" and carries neither the URL nor
 * the domain. The extension has the URL but measured no time at all. So the two
 * halves each hold one piece, and this file is the browser half.
 *
 * Three rules, each of which changes the numbers a lot:
 *
 *  - Only the ACTIVE tab in the FOCUSED window counts. Twenty open tabs are not
 *    twenty streams of attention.
 *  - Audible background tabs count for nothing. A playlist behind an editor is
 *    not screen time, and billing it as either work or distraction would be
 *    wrong in both directions.
 *  - Domain plus first path segment, never the query string: x.com/messages and
 *    x.com/home are opposite intents on one domain, while query strings carry
 *    session ids and tokens that should never be held in the first place.
 *
 * Everything stays in chrome.storage.local. Nothing here is sent anywhere.
 *
 * Classic script, not an ES module: the service worker loads its helpers with
 * importScripts (see history.js), so these are plain globals.
 */

const SITETIME_KEY = "ff-sitetime";
/** Shorter than this and it was navigation, not a visit. */
const MIN_SPAN_MS = 10_000;

let _open = null; // { key, label, startedAt }

/** (domain without www, first path segment) — query string dropped on purpose. */
function siteKey(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const seg = (u.pathname || "").split("/").find(Boolean) || "";
    return { host, seg, key: seg ? `${host}/${seg}` : host };
  } catch {
    return null;
  }
}

/**
 * Whether these seconds are attention at all.
 * `audible` is deliberately ignored: it is a reason to be careful, never a
 * reason to count. See the background-audio rule above.
 */
function countable({ active, windowFocused }) {
  return Boolean(active && windowFocused);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function readAll() {
  const got = await chrome.storage.local.get(SITETIME_KEY);
  const all = got[SITETIME_KEY];
  return all && typeof all === "object" ? all : {};
}

/** Close the running span and add it to today's totals. */
async function flushOpenSpan(now = Date.now()) {
  if (!_open) return;
  const span = _open;
  _open = null;
  const ms = now - span.startedAt;
  if (ms < MIN_SPAN_MS) return;

  const all = await readAll();
  const day = today();
  const bucket = all[day] || {};
  bucket[span.key] = (bucket[span.key] || 0) + Math.round(ms / 1000);
  all[day] = bucket;

  // 90 days of detail, per the privacy model. A log nobody reads is a leak in
  // waiting, so old days are dropped rather than kept "just in case".
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  for (const key of Object.keys(all)) {
    if (key < cutoff) delete all[key];
  }
  await chrome.storage.local.set({ [SITETIME_KEY]: all });
}

/** Called whenever the active tab, its URL, or window focus changes. */
async function noteActiveTab({ url, active, windowFocused }, now = Date.now()) {
  const site = countable({ active, windowFocused }) ? siteKey(url) : null;
  if (_open && (!site || _open.key !== site.key)) {
    await flushOpenSpan(now);
  }
  if (site && !_open) {
    _open = { key: site.key, startedAt: now };
  }
}

async function todayBySite() {
  const all = await readAll();
  return all[today()] || {};
}
