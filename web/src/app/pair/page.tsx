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
        const res = await fetch(`/api/blocker/pair?code=${encodeURIComponent(code)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Pair failed");
        window.postMessage(
          { source: "fellowship-focus", type: "FF_PAIR_CONNECT", payload: json },
          "*"
        );
        setStatus("ok");
        setDetail(`Connected as ${json.name || "member"}.`);
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
