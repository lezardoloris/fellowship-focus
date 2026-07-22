/* Bridge web app ↔ extension */
(function () {
  function reply(type, payload) {
    window.postMessage({ source: "fellowship-focus-ext", type, ...payload }, "*");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "fellowship-focus") return;

    if (data.type === "FF_ANALYZE_HISTORY") {
      chrome.runtime.sendMessage({ type: "analyzeHistory", days: data.days || 30 }, (res) => {
        reply("FF_HISTORY_RESULT", {
          ok: !chrome.runtime.lastError && res && !res.error,
          error: chrome.runtime.lastError?.message || res?.error || null,
          suggestions: res?.suggestions || [],
          requestId: data.requestId,
        });
      });
    }

    if (data.type === "FF_PAIR_CONNECT" && data.payload) {
      chrome.runtime.sendMessage({ type: "connect", payload: data.payload }, (res) => {
        reply("FF_PAIR_RESULT", {
          ok: !chrome.runtime.lastError && !!res?.config,
          error: chrome.runtime.lastError?.message || res?.error || null,
        });
      });
    }

    if (data.type === "FF_EXT_CMD") {
      const msg = { type: data.cmd, on: data.on };
      chrome.runtime.sendMessage(msg, (res) => {
        reply("FF_CMD_RESULT", {
          ok: !chrome.runtime.lastError && !res?.error,
          error: chrome.runtime.lastError?.message || res?.error || null,
          requestId: data.requestId,
          config: res?.config,
        });
      });
    }

    if (data.type === "FF_EXT_PING") {
      reply("FF_EXT_PONG", { version: chrome.runtime.getManifest().version });
    }
  });

  reply("FF_EXT_READY", { version: chrome.runtime.getManifest().version });

  try {
    const u = new URL(location.href);
    if (u.pathname === "/pair" && u.searchParams.get("code")) {
      chrome.runtime.sendMessage(
        { type: "pairFromCode", code: u.searchParams.get("code"), apiUrl: u.origin },
        () => {}
      );
    }
  } catch (e) {
    /* ignore */
  }
})();
