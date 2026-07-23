"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BlockerModeStatus = {
  /** Sites are actually blocked right now. */
  live: boolean;
  /** Desktop engine is starting / installing rules. */
  arming: boolean;
  busy: boolean;
  /** Desktop or extension can take the toggle. */
  connected: boolean;
  toggle: () => void | Promise<void>;
};

const IDLE: BlockerModeStatus = {
  live: false,
  arming: false,
  busy: false,
  connected: false,
  toggle: () => undefined,
};

type Ctx = {
  status: BlockerModeStatus;
  publish: (next: BlockerModeStatus | null) => void;
};

const BlockerModeContext = createContext<Ctx | null>(null);

/** App-wide Blocker Mode — the product moat, visible on every tab. */
export function BlockerModeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BlockerModeStatus>(IDLE);
  const publish = useCallback((next: BlockerModeStatus | null) => {
    setStatus(next ?? IDLE);
  }, []);
  const value = useMemo(() => ({ status, publish }), [status, publish]);
  return <BlockerModeContext.Provider value={value}>{children}</BlockerModeContext.Provider>;
}

function useBlockerModeCtx(): Ctx {
  const ctx = useContext(BlockerModeContext);
  if (!ctx) {
    throw new Error("BlockerModeProvider missing");
  }
  return ctx;
}

/**
 * BlockTab (always mounted) publishes live shield state + toggle so the
 * sticky header pill stays authoritative on Focus / Guild too.
 */
export function usePublishBlockerMode(status: BlockerModeStatus) {
  const { publish } = useBlockerModeCtx();
  const { live, arming, busy, connected, toggle } = status;
  useEffect(() => {
    publish({ live, arming, busy, connected, toggle });
    return () => publish(null);
  }, [publish, live, arming, busy, connected, toggle]);
}

/** Compact ON/OFF moat control — lives in the sticky app chrome. */
export function BlockerModePill({ className = "" }: { className?: string }) {
  const { status } = useBlockerModeCtx();
  const { live, arming, busy, connected, toggle } = status;

  return (
    <div
      className={`inline-flex select-none items-center gap-2.5 rounded-full border border-white/15 bg-[#0c0e10]/90 py-1 pl-3 pr-1 shadow-lg ${className}`}
      title="Blocker Mode — the core of Fellowship Focus"
    >
      <span className="hidden text-xs font-medium tracking-wide text-white/85 sm:inline">
        Blocker Mode
      </span>
      <span className="text-xs font-medium tracking-wide text-white/85 sm:hidden">Block</span>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          live ? "bg-emerald-400" : arming ? "animate-pulse bg-amber-400" : "bg-white/25"
        }`}
        aria-hidden
      />
      {!connected ? (
        <a
          href="/download"
          className="rounded-full px-2 py-1 text-[10px] text-white/70 transition hover:text-white"
        >
          Get app
        </a>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={live}
        aria-label={
          arming ? "Blocker Mode arming" : `Blocker Mode ${live ? "ON" : "OFF"}`
        }
        disabled={busy || arming}
        onClick={() => {
          void toggle();
        }}
        className={`min-w-[3.25rem] rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wider transition disabled:opacity-50 ${
          live || arming
            ? "bg-[#b8422e] text-white hover:bg-[#c46551]"
            : "bg-white/12 text-white/75 hover:bg-white/18 hover:text-white"
        }`}
      >
        {busy || arming ? "…" : live ? "ON" : "OFF"}
      </button>
    </div>
  );
}
