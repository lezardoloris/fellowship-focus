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
    window.postMessage({ source: "fellowship-focus", type: "FF_EXT_PING", requestId: requestId() }, "*");
  });
}

export function analyzeHistoryViaExtension(days = 30, timeoutMs = 12000): Promise<HistorySuggestion[]> {
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
      reject(new Error("Extension missing — load fellowship-focus/extension in chrome://extensions"));
    }, timeoutMs);
    window.addEventListener("message", onMsg);
    window.postMessage(
      { source: "fellowship-focus", type: "FF_ANALYZE_HISTORY", days, requestId: id },
      "*"
    );
  });
}

/** Real extension state — reflects installed DNR rules, not just "is it alive". */
export type ExtensionState = {
  ready: boolean;
  shieldOn: boolean;
  manualShield: boolean;
  focusOn: boolean;
  siteCount: number;
  ruleCount: number;
  version: string;
};

export function getExtensionState(timeoutMs = 2500): Promise<ExtensionState | null> {
  return new Promise((resolve) => {
    const id = requestId();
    const onMsg = (event: MessageEvent) => {
      const d = event.data;
      if (d?.source !== "fellowship-focus-ext" || d.type !== "FF_EXT_STATE_RESULT") return;
      if (d.requestId && d.requestId !== id) return;
      cleanup();
      resolve(d.ok && d.status ? (d.status as ExtensionState) : null);
    };
    const cleanup = () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "fellowship-focus", type: "FF_EXT_STATE", requestId: id }, "*");
  });
}

/** True only when the extension is actually blocking something right now. */
export function isArmed(state: ExtensionState | null): boolean {
  return Boolean(state?.shieldOn && state.ruleCount > 0);
}

/** One-shot connect: push apiUrl/token/sites into the extension. */
export function connectExtension(
  payload: Record<string, unknown>,
  timeoutMs = 6000
): Promise<ExtensionState | null> {
  return new Promise((resolve) => {
    const id = requestId();
    const onMsg = (event: MessageEvent) => {
      const d = event.data;
      if (d?.source !== "fellowship-focus-ext" || d.type !== "FF_PAIR_RESULT") return;
      if (d.requestId && d.requestId !== id) return;
      cleanup();
      resolve(d.ok ? ((d.status as ExtensionState) ?? null) : null);
    };
    const cleanup = () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    window.addEventListener("message", onMsg);
    window.postMessage(
      { source: "fellowship-focus", type: "FF_PAIR_CONNECT", payload, requestId: id },
      "*"
    );
  });
}

export function extensionCommand(
  type: "setShield" | "startFocus" | "stopFocus" | "refresh" | "setSites",
  extra?: Record<string, unknown>,
  timeoutMs = 3000
): Promise<boolean> {
  return new Promise((resolve) => {
    const id = requestId();
    const onMsg = (event: MessageEvent) => {
      const d = event.data;
      if (d?.source !== "fellowship-focus-ext" || d.type !== "FF_CMD_RESULT") return;
      if (d.requestId && d.requestId !== id) return;
      cleanup();
      resolve(Boolean(d.ok));
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
    window.postMessage(
      { source: "fellowship-focus", type: "FF_EXT_CMD", cmd: type, requestId: id, ...extra },
      "*"
    );
  });
}
