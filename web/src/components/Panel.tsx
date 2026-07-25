"use client";

import type { ReactNode } from "react";

/**
 * The one panel. [UX-E6]
 *
 * The audit found 6 coexisting card styles (.glass-panel ×35, .premium-panel
 * ×9, .glass-card, .pill-glass and two ad-hoc translucent tiles), with three
 * different hover behaviours — and two of them rendered stacked on the Focus
 * tab. Everything new uses this; existing call sites migrate to it.
 */
export function Panel({
  title,
  actions,
  minHeight,
  padded = true,
  className = "",
  children,
}: {
  /** Small uppercase section label. */
  title?: ReactNode;
  /** Right-aligned controls on the title row. */
  actions?: ReactNode;
  /** Reserve height so loading/tab changes don't move neighbours. */
  minHeight?: number;
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`premium-panel ${padded ? "p-5" : ""} ${className}`}
      style={minHeight ? { minHeight } : undefined}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2">
          {title ? <p className="pp-title">{title}</p> : <span />}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * A labelled metric. The audit found ~19 duplications in 3 different visual
 * styles (Focus tab KPIs, Agenda KPIs, Money tiles). [UX-E6]
 */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "good" | "bad";
}) {
  const toneClass =
    tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "pp-strong";
  return (
    <div>
      <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-xs pp-faint">{label}</p>
      {sub ? <div className="text-xs">{sub}</div> : null}
    </div>
  );
}

/**
 * "Nothing here yet". ~15 sites currently say this in 15 different ways, most
 * of them below AA contrast. [UX-E6]
 */
export function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="py-3 text-sm pp-faint">
      {children}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * A failed fetch used to render as a permanently missing panel with no
 * explanation — every call site was a silent `if (res.ok)`. Now it says what
 * happened and offers a retry. [UX-E3.2]
 */
export function ErrorState({
  onRetry,
  children = "Couldn't load this.",
}: {
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="premium-panel p-5">
      <p className="text-sm pp-body">{children}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold pp-body transition-colors hover:bg-white/10"
        >
          Try again
        </button>
      )}
    </div>
  );
}
