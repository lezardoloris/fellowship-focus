/** Talk to the Fellowship Focus Chrome extension via content-script bridge. */

export type HistorySuggestion = {
  domain: string;
  visits: number;
  lastVisit?: number;
  score: number;
};

function requestId() {
  return `ff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function pingExtension(timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const id = requestId();
    const onMsg = (event: MessageEvent) => {
      const d = event.data;
      if (d?.source !== "fellowship-focus-ext") return;
      if (d.type === "FF_EXT_PONG" || d.type === "FF_EXT_READY") {
        cleanup();
        resolve(true);
      }
    };
    const cleanup = () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "fellowship-focus", type: "FF_EXT_PING", requestId: id }, "*");
  });
}

export function analyzeHistoryViaExtension(days = 30, timeoutMs = 15000): Promise<HistorySuggestion[]> {
  return new Promise((resolve, reject) => {
    const id = requestId();
    const onMsg = (event: MessageEvent) => {
      const d = event.data;
      if (d?.source !== "fellowship-focus-ext" || d.type !== "FF_HISTORY_RESULT") return;
      if (d.requestId && d.requestId !== id) return;
      cleanup();
      if (!d.ok) reject(new Error(d.error || "history_failed"));
      else resolve((d.suggestions || []) as HistorySuggestion[]);
    };
    const cleanup = () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timeout — install/reload the Fellowship Focus extension"));
    }, timeoutMs);
    window.addEventListener("message", onMsg);
    window.postMessage(
      { source: "fellowship-focus", type: "FF_ANALYZE_HISTORY", days, requestId: id },
      "*"
    );
  });
}
