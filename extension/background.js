const BLOCK_RULES_ID = "blocklist";

const BLOCKED_DOMAINS = [
  "twitter.com",
  "x.com",
  "reddit.com",
  "old.reddit.com",
  "youtube.com",
  "youtu.be",
  "m.youtube.com",
  "music.youtube.com",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "m.facebook.com",
  "tiktok.com",
  "threads.net",
  "snapchat.com",
  "pinterest.com",
  "tumblr.com",
  "linkedin.com",
  "twitch.tv",
  "discord.com",
  "netflix.com",
  "disneyplus.com",
  "primevideo.com",
  "hulu.com",
  "crunchyroll.com",
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "redtube.com",
  "onlyfans.com",
  "chaturbate.com",
];

async function enableBlocking() {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [BLOCK_RULES_ID],
    disableRulesetIds: [],
  });
}

async function disableBlocking() {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [],
    disableRulesetIds: [BLOCK_RULES_ID],
  });
}

function isBlockedUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

const recentBlocks = new Set();

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !tab.url) return;
  const { sessionActive, token, apiUrl } = await chrome.storage.local.get([
    "sessionActive",
    "token",
    "apiUrl",
  ]);
  if (!sessionActive || !token || !apiUrl) return;
  if (!isBlockedUrl(tab.url)) return;

  const host = new URL(tab.url).hostname;
  const key = `${host}-${Math.floor(Date.now() / 30000)}`;
  if (recentBlocks.has(key)) return;
  recentBlocks.add(key);
  setTimeout(() => recentBlocks.delete(key), 30000);

  await fetch(`${apiUrl}/api/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, site: host }),
  }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ENABLE_BLOCKING") {
    enableBlocking().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "DISABLE_BLOCKING") {
    disableBlocking().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "COMPLETE_SESSION") {
    completeSession(message.minutes, message.completed).then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "focus-timer") {
    const data = await chrome.storage.local.get([
      "endTime",
      "sessionActive",
      "durationMinutes",
    ]);
    if (!data.sessionActive) return;
    if (data.endTime - Date.now() <= 0) {
      await completeSession(data.durationMinutes, true);
    }
  }
});

async function completeSession(minutes, completed) {
  const { token, apiUrl } = await chrome.storage.local.get(["token", "apiUrl"]);
  await disableBlocking();
  await chrome.storage.local.set({ sessionActive: false, endTime: null });
  chrome.alarms.clear("focus-timer");

  if (token && apiUrl) {
    await fetch(`${apiUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, minutes, completed }),
    }).catch(() => {});
  }

  chrome.action.setBadgeText({ text: "" });
}
