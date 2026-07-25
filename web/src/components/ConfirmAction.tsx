"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * In-app confirmation. [UX-E6.4]
 *
 * Replaces native window.confirm(), which renders OS chrome on top of the
 * looping video — the loudest "this is cheap" tell in the product, and
 * unstyleable. Also supports the blocker's deliberate friction delay.
 */
export type ConfirmRequest = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Seconds the confirm button stays disabled (hard-mode friction). */
  delaySecs?: number;
  danger?: boolean;
};

export function ConfirmDialog({
  request,
  onResolve,
}: {
  request: ConfirmRequest | null;
  onResolve: (ok: boolean) => void;
}) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!request) return;
    setLeft(request.delaySecs ?? 0);
    if (!request.delaySecs) return;
    const id = setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(id);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResolve(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onResolve]);

  if (!request) return null;
  const blocked = left > 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => onResolve(false)}
    >
      <div
        className="premium-panel w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-semibold pp-strong">{request.title}</p>
        {request.message && <p className="mt-2 text-sm pp-body">{request.message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium pp-body transition-colors hover:bg-white/10"
          >
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            disabled={blocked}
            onClick={() => onResolve(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              request.danger ? "bg-danger" : "bg-[#b8422e] hover:bg-accent-hover"
            }`}
          >
            {blocked ? `${request.confirmLabel ?? "Confirm"} (${left}s)` : request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Module-level bridge so non-component code (e.g. requestHardUnlock, which is
 * a plain async function) can still raise the in-app dialog instead of the
 * native one. The app registers the real implementation once at mount; until
 * then we degrade to window.confirm rather than silently failing open.
 */
let _confirmImpl: ((req: ConfirmRequest) => Promise<boolean>) | null = null;

export function setConfirmImpl(fn: ((req: ConfirmRequest) => Promise<boolean>) | null) {
  _confirmImpl = fn;
}

export async function appConfirm(req: ConfirmRequest): Promise<boolean> {
  if (_confirmImpl) return _confirmImpl(req);
  if (typeof window === "undefined") return false;
  return window.confirm(req.message ? `${req.title}\n\n${req.message}` : req.title);
}

/** Promise-based confirm you can `await`, like window.confirm but in-app. */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback((req: ConfirmRequest) => {
    setRequest(req);
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  }, []);

  const onResolve = useCallback(
    (ok: boolean) => {
      setRequest(null);
      resolver?.(ok);
      setResolver(null);
    },
    [resolver]
  );

  return { confirm, dialog: <ConfirmDialog request={request} onResolve={onResolve} /> };
}
