// Bridge to the Fellowship Focus desktop app (Qt WebChannel).
// When the web app runs inside the desktop window, `window.ffdesktop` is
// injected and lets the Block tab drive the real system-wide blocker.

export type DesktopState = {
  available: boolean;
  shieldOn: boolean;
  active: boolean;
  /** Engine is booting: proxy not yet switched on, shield not yet ON. */
  arming?: boolean;
  certReady: boolean;
  sites: string[];
};

type QtSlot = (...args: unknown[]) => void;
type RawBridge = {
  state: (cb: (r: string) => void) => void;
  setShield: (on: boolean, cb: (r: string) => void) => void;
  addSites: (json: string, cb: (r: string) => void) => void;
  removeSite: (site: string, cb: (r: string) => void) => void;
  weeklyStats?: (cb: (r: string) => void) => void;
  setOkr?: (json: string, cb: (r: string) => void) => void;
  showFloatTimer?: (json: string, cb?: (r: string) => void) => void;
  hideFloatTimer?: (cb?: (r: string) => void) => void;
  musicState?: (cb: (r: string) => void) => void;
  musicCmd?: (json: string, cb: (r: string) => void) => void;
  setPrefs?: (json: string, cb: (r: string) => void) => void;
} & Record<string, QtSlot>;

export type MusicState = {
  available: boolean;
  tracks: string[];
  index: number;
  playing: boolean;
  volume: number;
};

export type FloatTimerPayload = {
  remaining: number;
  phase: string;
  cycle: number;
  cycles: number;
  label: string;
  /** When true, desktop float must freeze (no local tick-down). */
  paused?: boolean;
  /** Focus hit 0 — waiting for break / snooze / extend (web owns the prompt). */
  awaitingBreak?: boolean;
  /** Prefer expanded card (desktop may still toggle locally). */
  expanded?: boolean;
};

export type WeeklyStatsDay = {
  date: string;
  weekday: string;
  work_seconds: number;
  distraction_seconds: number;
  focus_minutes: number;
  focus_score: number;
};

export type WeeklyStats = {
  available: boolean;
  weekStart: string;
  days: WeeklyStatsDay[];
  history: Array<{ weekStart: string; work_minutes: number; avg_focus_score: number }>;
  kpis: {
    focus_hours: number;
    avg_focus_score: number;
    distraction_hours: number;
    streak: number;
    focus_days: number;
  };
  league: { name: string; hours: number; next: { name: string; at: number } | null };
  okr: {
    focus_hours: { current: number; target: number };
    focus_score: { current: number; target: number };
    revenue: { current_eur: number; target_eur: number };
  };
};

declare global {
  interface Window {
    ffdesktop?: RawBridge;
  }
}

const EMPTY: DesktopState = {
  available: false,
  shieldOn: false,
  active: false,
  certReady: false,
  sites: [],
};

function raw(): RawBridge | null {
  if (typeof window === "undefined") return null;
  return window.ffdesktop ?? null;
}

function parse(r: string): DesktopState {
  try {
    const obj = JSON.parse(r) as Partial<DesktopState>;
    return { ...EMPTY, available: true, ...obj, sites: obj.sites ?? [] };
  } catch {
    return EMPTY;
  }
}

/**
 * True when the page is running inside the desktop app's webview.
 *
 * Independent of the WebChannel handshake: the desktop appends a marker to its
 * user agent (see web_dashboard.py). The handshake can be late or fail, and when
 * it did the app fell back to browser mode and offered "Get the app" to someone
 * already inside the app. The UA can't be late.
 */
export function isDesktopShell(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return ua.includes("FellowshipFocusDesktop") || ua.includes("QtWebEngine");
}

export const desktopBridge = {
  present(): boolean {
    return raw() !== null;
  },

  /**
   * Resolves as soon as the desktop bridge is injected (via event OR polling),
   * or after a hard timeout. Polling matters because the Qt WebChannel handshake
   * can land slightly after the page mounts — a one-shot timeout would miss it
   * and strand the app in non-enforcing browser mode.
   */
  ready(): Promise<void> {
    return new Promise((resolve) => {
      if (raw()) return resolve();
      if (typeof window === "undefined") return resolve();
      let done = false;
      let poll: ReturnType<typeof setInterval>;
      let timeout: ReturnType<typeof setTimeout>;
      const onEvent = () => finish();
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener("ffdesktop-ready", onEvent);
        clearInterval(poll);
        clearTimeout(timeout);
        resolve();
      };
      window.addEventListener("ffdesktop-ready", onEvent);
      poll = setInterval(() => {
        if (raw()) finish();
      }, 150);
      // 500 ms was not enough: loading the remote dashboard and completing the
      // WebChannel handshake regularly lands later, which stranded the desktop
      // app in browser mode and made it demand the Chrome extension.
      timeout = setTimeout(finish, 6000);
    });
  },

  getState(): Promise<DesktopState> {
    const b = raw();
    if (!b) return Promise.resolve(EMPTY);
    return new Promise((resolve) => {
      try {
        b.state((r) => resolve(parse(r)));
      } catch {
        resolve(EMPTY);
      }
    });
  },

  /** Native Qt player state — drives the web music panel inside the app,
   * where the actual .mp3 files live (they are too large to ship to the web). */
  musicState(): Promise<MusicState | null> {
    const b = raw();
    if (!b?.musicState) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        b.musicState!((r) => {
          try {
            resolve(JSON.parse(r) as MusicState);
          } catch {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  },

  /** Push web-edited prefs (blocker_mode, block_style) into the desktop config. */
  setPrefs(patch: Record<string, unknown>): Promise<DesktopState> {
    const b = raw();
    if (!b?.setPrefs) return Promise.resolve(EMPTY);
    return new Promise((resolve) => {
      try {
        b.setPrefs!(JSON.stringify(patch), (r) => resolve(parse(r)));
      } catch {
        resolve(EMPTY);
      }
    });
  },

  musicCmd(payload: Record<string, unknown>): Promise<MusicState | null> {
    const b = raw();
    if (!b?.musicCmd) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        b.musicCmd!(JSON.stringify(payload), (r) => {
          try {
            resolve(JSON.parse(r) as MusicState);
          } catch {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  },

  setShield(on: boolean): Promise<DesktopState> {
    const b = raw();
    if (!b) return Promise.resolve(EMPTY);
    return new Promise((resolve) => {
      try {
        b.setShield(on, (r) => resolve(parse(r)));
      } catch {
        resolve(EMPTY);
      }
    });
  },

  addSites(sites: string[]): Promise<DesktopState> {
    const b = raw();
    if (!b) return Promise.resolve(EMPTY);
    return new Promise((resolve) => {
      try {
        b.addSites(JSON.stringify(sites), (r) => resolve(parse(r)));
      } catch {
        resolve(EMPTY);
      }
    });
  },

  removeSite(site: string): Promise<DesktopState> {
    const b = raw();
    if (!b) return Promise.resolve(EMPTY);
    return new Promise((resolve) => {
      try {
        b.removeSite(site, (r) => resolve(parse(r)));
      } catch {
        resolve(EMPTY);
      }
    });
  },

  getWeeklyStats(): Promise<WeeklyStats | null> {
    const b = raw();
    if (!b || typeof b.weeklyStats !== "function") return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        b.weeklyStats!((r) => resolve(parseStats(r)));
      } catch {
        resolve(null);
      }
    });
  },

  setOkr(patch: Record<string, number>): Promise<WeeklyStats | null> {
    const b = raw();
    if (!b || typeof b.setOkr !== "function") return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        b.setOkr!(JSON.stringify(patch), (r) => resolve(parseStats(r)));
      } catch {
        resolve(null);
      }
    });
  },

  showFloatTimer(payload: FloatTimerPayload): void {
    const b = raw();
    if (!b || typeof b.showFloatTimer !== "function") return;
    try {
      b.showFloatTimer!(JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  },

  hideFloatTimer(): void {
    const b = raw();
    if (!b || typeof b.hideFloatTimer !== "function") return;
    try {
      b.hideFloatTimer!();
    } catch {
      /* ignore */
    }
  },
};

function parseStats(r: string): WeeklyStats | null {
  try {
    const obj = JSON.parse(r) as WeeklyStats;
    return obj && obj.available ? obj : null;
  } catch {
    return null;
  }
}
