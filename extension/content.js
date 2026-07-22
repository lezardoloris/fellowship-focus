/* Bridge web app ↔ extension for history suggestions + one-click pairing. */
(function () {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "fellowship-focus") return;

    if (data.type === "FF_ANALYZE_HISTORY") {
      chrome.runtime.sendMessage({ type: "analyzeHistory", days: data.days || 30 }, (res) => {
        window.postMessage(
          {
            source: "fellowship-focus-ext",
            type: "FF_HISTORY_RESULT",
            ok: !chrome.runtime.lastError && res && !res.error,
            error: chrome.runtime.lastError?.message || res?.error || null,
            suggestions: res?.suggestions || [],
            requestId: data.requestId,
          },
          "*"
        );
      });
    }

    if (data.type === "FF_PAIR_CONNECT" && data.payload) {
      chrome.runtime.sendMessage({ type: "connect", payload: data.payload }, (res) => {
        window.postMessage(
          {
            source: "fellowship-focus-ext",
            type: "FF_PAIR_RESULT",
            ok: !chrome.runtime.lastError && res?.config,
            error: chrome.runtime.lastError?.message || res?.error || null,
          },
          "*"
        );
      });
    }

    if (data.type === "FF_EXT_PING") {
      window.postMessage(
        { source: "fellowship-focus-ext", type: "FF_EXT_PONG", version: chrome.runtime.getManifest().version },
        "*"
      );
    }
  });

  window.postMessage({ source: "fellowship-focus-ext", type: "FF_EXT_READY" }, "*");

  // Auto-pair if landing on /pair?code=
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
