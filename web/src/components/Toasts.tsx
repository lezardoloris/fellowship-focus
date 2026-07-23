"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ToastKind = "error" | "info" | "ok";

type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
};

type ToastApi = {
  push: (kind: ToastKind, title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  ok: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let idSeq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = `t-${++idSeq}-${Date.now()}`;
    setItems((prev) => [...prev.slice(-4), { id, kind, title, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      error: (title, message) => push("error", title, message),
      info: (title, message) => push("info", title, message),
      ok: (title, message) => push("ok", title, message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (typeof console !== "undefined") {
      console.warn("[toast] ToastProvider missing — notification dropped");
    }
    return {
      push: () => {},
      error: () => {},
      info: () => {},
      ok: () => {},
    };
  }
  return ctx;
}

function ToastHost({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const hasError = items.some((t) => t.kind === "error");
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[10000] flex w-[min(100vw-2rem,22rem)] flex-col-reverse gap-2"
      aria-live={hasError ? "assertive" : "polite"}
    >
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const ms = item.kind === "error" ? 6000 : 3500;
    const timer = setTimeout(() => onDismiss(item.id), ms);
    return () => clearTimeout(timer);
  }, [item.id, item.kind, onDismiss]);

  const tone =
    item.kind === "error"
      ? "border-[#b8422e]/50 bg-[#1a1010]/95 text-[#fecaca]"
      : item.kind === "ok"
        ? "border-emerald-500/40 bg-[#0f1a14]/95 text-emerald-100"
        : "border-white/15 bg-[#141618]/95 text-white/90";

  const label = item.kind === "error" ? "Error" : item.kind === "ok" ? "Success" : "Info";

  return (
    <div
      className={`pointer-events-auto rounded-xl border px-3.5 py-3 shadow-2xl backdrop-blur-md ${tone}`}
      role={item.kind === "error" ? "alert" : "status"}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-60">{label}</p>
          <p className="mt-0.5 text-sm font-medium leading-snug">{item.title}</p>
          {item.message ? (
            <p className="mt-1 text-xs leading-snug opacity-70">{item.message}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-sm opacity-50 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
