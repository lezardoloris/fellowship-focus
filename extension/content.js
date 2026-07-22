/* Bridge web app ↔ extension */
(function () {
  // Envelope shape the web app listens for.
  function send(type, payload) {
    window.postMessage({ source: "fellowship-focus-ext", type, ...payload }, "*");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "fellowship-focus") return;

    if (data.type === "FF_ANALYZE_HISTORY") {
      chrome.runtime.sendMessage({ type: "analyzeHistory", days: data.days || 30 }, (res) => {
        send("FF_HISTORY_RESULT", {
          ok: !chrome.runtime.lastError && res && !res.error,
          error: chrome.runtime.lastError?.message || res?.error || null,
          suggestions: res?.suggestions || [],
          requestId: data.requestId,
        });
      });
    }

    if (data.type === "FF_PAIR_CONNECT" && data.payload) {
      chrome.runtime.sendMessage({ type: "connect", payload: data.payload }, (res) => {
        send("FF_PAIR_RESULT", {
          ok: !chrome.runtime.lastError && !!res?.config,
          error: chrome.runtime.lastError?.message || res?.error || null,
          status: res?.status || null,
          requestId: data.requestId,
        });
      });
    }

    // Full status — real shield state and installed rule count, not a ping.
    if (data.type === "FF_EXT_STATE") {
      chrome.runtime.sendMessage({ type: "getStatus" }, (res) => {
        send("FF_EXT_STATE_RESULT", {
          ok: !chrome.runtime.lastError && !!res?.status,
          error: chrome.runtime.lastError?.message || res?.error || null,
          status: res?.status || null,
          requestId: data.requestId,
        });
      });
    }

    if (data.type === "FF_EXT_CMD") {
      const msg = { type: data.cmd, on: data.on };
      if (data.sites) msg.sites = data.sites;
      if (data.domain) msg.domain = data.domain;
      if (data.secs) msg.secs = data.secs;
      chrome.runtime.sendMessage(msg, (res) => {
        send("FF_CMD_RESULT", {
          ok: !chrome.runtime.lastError && !res?.error,
          error: chrome.runtime.lastError?.message || res?.error || null,
          requestId: data.requestId,
          config: res?.config,
          status: res?.status || null,
        });
      });
    }

    if (data.type === "FF_EXT_PING") {
      send("FF_EXT_PONG", { version: chrome.runtime.getManifest().version, extId: chrome.runtime.id });
    }
  });

  send("FF_EXT_READY", { version: chrome.runtime.getManifest().version, extId: chrome.runtime.id });

  // NOTE: /pair codes are single-use and are redeemed by the pair page itself.
  // The content script must not redeem them too — both racing for the same code
  // meant one side always got "invalid_or_expired" and pairing looked broken.
})();
