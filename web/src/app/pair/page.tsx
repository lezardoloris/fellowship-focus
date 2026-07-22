"use client";

import { useEffect, useState } from "react";
import { ImmersiveScene } from "@/components/ImmersiveScene";

/** Extension opens /pair?code=… — page posts credentials to the extension bridge. */
export default function PairPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [detail, setDetail] = useState("Pairing…");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setStatus("error");
      setDetail("Missing pair code.");
      return;
    }
    (async () => {
      try {
        // This page is the SINGLE consumer of the one-time code. The content
        // script must never redeem it too, or one side gets invalid_or_expired.
        const res = await fetch(`/api/blocker/pair?code=${encodeURIComponent(code)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Pair failed");

        // Ship the block list with the credentials, otherwise the extension
        // arms with an empty list and blocks nothing.
        let sites: string[] = [];
        try {
          const cfg = await fetch(
            `/api/blocker/config?token=${encodeURIComponent(json.token)}`
          ).then((r) => (r.ok ? r.json() : null));
          if (Array.isArray(cfg?.sites)) {
            sites = cfg.sites.map((s: { site: string } | string) =>
              typeof s === "string" ? s : s.site
            );
          }
        } catch {
          /* pair anyway — the extension will sync the list itself */
        }

        const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          const onMsg = (e: MessageEvent) => {
            const d = e.data;
            if (d?.source !== "fellowship-focus-ext" || d.type !== "FF_PAIR_RESULT") return;
            window.removeEventListener("message", onMsg);
            clearTimeout(timer);
            resolve({ ok: Boolean(d.ok), error: d.error });
          };
          const timer = setTimeout(() => {
            window.removeEventListener("message", onMsg);
            resolve({ ok: false, error: "Extension did not answer" });
          }, 6000);
          window.addEventListener("message", onMsg);
          window.postMessage(
            {
              source: "fellowship-focus",
              type: "FF_PAIR_CONNECT",
              payload: { ...json, sites, shieldOn: true },
            },
            "*"
          );
        });

        if (!result.ok) {
          throw new Error(
            result.error || "Extension not reachable — reload it in chrome://extensions"
          );
        }
        setStatus("ok");
        setDetail(`Connected as ${json.name || "member"}. Shield armed.`);
        setTimeout(() => {
          window.location.href = "/app";
        }, 1500);
      } catch (e) {
        setStatus("error");
        setDetail(e instanceof Error ? e.message : "Pair failed");
      }
    })();
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 text-white">
      <ImmersiveScene scene="sentinel" />
      <div className="glass-panel relative z-10 max-w-md p-8 text-center">
        <p className="font-display text-sm tracking-[0.2em] text-white/50">FELLOWSHIP FOCUS</p>
        <h1 className="mt-2 text-xl font-semibold">
          {status === "loading" ? "Pairing…" : status === "ok" ? "Paired" : "Pair failed"}
        </h1>
        <p className="mt-3 text-sm text-white/60">{detail}</p>
      </div>
    </main>
  );
}
