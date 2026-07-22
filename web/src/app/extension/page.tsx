"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImmersiveScene } from "@/components/ImmersiveScene";
import { DOWNLOAD_SCENE } from "@/lib/scenes";
import { getExtensionState, isArmed, type ExtensionState } from "@/lib/extensionBridge";

const STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "";

export default function ExtensionPage() {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const s = await getExtensionState(1500);
      if (!alive) return;
      setState(s);
      setChecked(true);
    };
    check();
    const id = setInterval(check, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const installed = Boolean(state);

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <ImmersiveScene scene={DOWNLOAD_SCENE} />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-16">
        <Link href="/" className="mb-8 inline-block text-sm text-white/70 hover:text-white">
          ← Back
        </Link>

        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
          Chrome extension
        </p>
        <h1 className="mb-4 font-display text-4xl font-bold drop-shadow-lg md:text-5xl">
          Block in <span className="accent-text">Chrome</span> in one click
        </h1>
        <p className="mb-10 text-lg text-white/75">
          The extension blocks distracting sites the instant you open them. For
          system-wide blocking across every browser and app, use{" "}
          <Link href="/download" className="accent-text underline">
            the desktop app
          </Link>
          .
        </p>

        <div className="glass-panel mb-8 p-8">
          {installed ? (
            <div className="text-center">
              <p className="mb-1 text-lg font-semibold text-emerald-400">
                Extension installed ✓
              </p>
              <p className="text-sm text-white/70">
                Shield {isArmed(state) ? "ON" : "OFF"} · {state?.siteCount ?? 0} sites ·
                v{state?.version}
              </p>
              <Link href="/app" className="btn-primary mt-6 inline-block min-w-[240px]">
                Open the app
              </Link>
            </div>
          ) : (
            <div className="text-center">
              {STORE_URL ? (
                <a
                  href={STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary inline-block min-w-[280px]"
                >
                  Add to Chrome
                </a>
              ) : (
                <div className="text-left">
                  <p className="mb-3 text-center text-sm text-white/70">
                    Coming to the Chrome Web Store. Until then, load it in 20 seconds:
                  </p>
                  <ol className="mx-auto max-w-md list-decimal space-y-2 pl-5 text-sm text-white/80">
                    <li>
                      Get{" "}
                      <a
                        href="https://github.com/lezardoloris/fellowship-focus/tree/master/extension"
                        target="_blank"
                        rel="noreferrer"
                        className="accent-text underline"
                      >
                        the extension folder
                      </a>{" "}
                      (green Code button → Download ZIP → unzip).
                    </li>
                    <li>
                      Open{" "}
                      <code className="rounded bg-white/10 px-1 py-0.5">chrome://extensions</code>.
                    </li>
                    <li>Turn on Developer mode (top right).</li>
                    <li>Click Load unpacked and pick the unzipped folder.</li>
                  </ol>
                </div>
              )}
              {checked && (
                <p className="mt-4 text-xs text-white/45">
                  Not detected yet — reload this page after installing.
                </p>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-white/50">
          The extension is privacy-first. Read the{" "}
          <Link href="/privacy" className="underline hover:text-white/80">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
