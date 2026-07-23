/** Talk to the Fellowship Focus Chrome extension.
 *
 * Two channels, tried in order:
 *  1. Direct — chrome.runtime.sendMessage(extId, …) via externally_connectable.
 *     Robust: works even if the content script didn't inject on this origin.
 *  2. Fallback — window.postMessage relayed by the content script (legacy).
 * The extension id is discovered at runtime from FF_EXT_READY/PONG, so it keeps
 * working after the Chrome Web Store assigns a different id at publish time.
 */

export type HistorySuggestion = {
  domain: string;
  visits: number;
  lastVisit?: number;
  score: number;
};

function requestId() {
  return `ff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Direct channel (externally_connectable) ──

type ChromeRuntime = {
  sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void;
  lastError?: { message?: string } | undefined;
};
function chromeRuntime(): ChromeRuntime | null {
  const c = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome;
  return c?.runtime ?? null;
}

let discoveredExtId: string | null = null;

/** Capture the extension id the moment it announces itself. */
if (typeof window !== "undefined") {
  window.addEventListener("message", (event: MessageEvent) => {
    // Only trust same-window extension announcements (content script).
    if (event.source !== window) return;
    const d = event.data;
    if (d?.source === "fellowship-focus-ext" && typeof d.extId === "string") {
      discoveredExtId = d.extId;
    }
  });
}

/** Send a message straight to the extension; null if the direct channel is unavailable. */
function sendDirect<T = unknown>(msg: unknown, timeoutMs = 2500): Promise<T | null> {
  return new Promise((resolve) => {
    const rt = chromeRuntime();
    if (!rt?.sendMessage || !discoveredExtId) return resolve(null);
    let settled = false;
    const done = (v: T | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    try {
      rt.sendMessage(discoveredExtId, msg, (r: unknown) => {
        clearTimeout(timer);
        if (chromeRuntime()?.lastError) return done(null);
        done((r as T) ?? null);
      });
    } catch {
      clearTimeout(timer);
      done(null);
    }
  });
}

export function pingExtension(timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
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
      if (event.source !== window) return;
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
  /** Real declarativeNetRequest rule count (0 in notify mode by design). */
  ruleCount: number;
  /** Effective enforce list size (includes hard-mode auto-hosts). */
  coveredSites?: number;
  mode: "soft" | "hard";
  blockStyle?: "notify" | "page";
  /** Verified canary — null/undefined = legacy; true/false when health loop reports. */
  canaryOk?: boolean | null;
  lastCanaryAt?: number | null;
  blocksToday: number;
  focusMinutesToday: number;
  version: string;
};

export async function getExtensionState(timeoutMs = 2500): Promise<ExtensionState | null> {
  // Prefer the direct channel; it works even where the content script can't run.
  const direct = await sendDirect<{ status?: ExtensionState }>({ type: "getStatus" }, timeoutMs);
  if (direct?.status) return direct.status;

  // Fallback: content-script relay.
  return new Promise((resolve) => {
    const id = requestId();
    const onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
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

/** True when shield is on and enforcement is verified (canary) or legacy-coherent. */
export function isArmed(state: ExtensionState | null): boolean {
  if (!state?.shieldOn) return false;
  // Prefer verified canary when the extension health loop reports it.
  if (typeof state.canaryOk === "boolean") return state.canaryOk;
  if (state.ruleCount > 0) return true;
  // Notify mode installs zero DNR redirects; coveredSites is the real enforce list.
  if (state.blockStyle === "notify" && (state.coveredSites ?? state.siteCount) > 0) return true;
  return false;
}

/** One-shot connect: push apiUrl/token/sites into the extension. Prefer direct channel. */
export async function connectExtension(
  payload: Record<string, unknown>,
  timeoutMs = 6000
): Promise<ExtensionState | null> {
  const direct = await sendDirect<{ status?: ExtensionState; config?: unknown; error?: string }>(
    { type: "connect", payload },
    timeoutMs
  );
  if (direct?.status) return direct.status;
  if (direct && !direct.error) {
    // connect replied without status — fetch it
    const st = await getExtensionState(timeoutMs);
    if (st) return st;
  }

  return new Promise((resolve) => {
    const id = requestId();
    const onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
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

export type ExtensionCommand =
  | "setShield"
  | "startFocus"
  | "stopFocus"
  | "pauseFocus"
  | "resumeFocus"
  | "refresh"
  | "setSites";

/** Prefer direct channel; fall back to content-script postMessage. */
export async function extensionCommand(
  type: ExtensionCommand,
  extra?: Record<string, unknown>,
  timeoutMs = 3000
): Promise<boolean> {
  const direct = await sendDirect<{ ok?: boolean; error?: string; status?: ExtensionState }>(
    { type, ...extra },
    timeoutMs
  );
  if (direct) {
    if (direct.error === "locked") return false;
    if (direct.status || direct.ok !== false) return true;
  }

  return new Promise((resolve) => {
    const id = requestId();
    const onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
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
