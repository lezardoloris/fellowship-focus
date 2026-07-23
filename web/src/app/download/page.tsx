"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImmersiveScene } from "@/components/ImmersiveScene";
import { DOWNLOAD_SCENE } from "@/lib/scenes";
import { isDesktopShell } from "@/lib/desktop";

type DownloadInfo = {
  version: string | null;
  available: boolean;
  windowsUrl: string | null;
  filename: string | null;
};

export default function DownloadPage() {
  const router = useRouter();
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [inDesktop, setInDesktop] = useState(false);

  useEffect(() => {
    // Already running inside Fellowship Focus — don't sell the installer again.
    if (isDesktopShell()) {
      setInDesktop(true);
      router.replace("/");
      return;
    }
    fetch("/api/download/latest")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ version: null, available: false, windowsUrl: null, filename: null }));
  }, [router]);

  if (inDesktop) {
    return (
      <main className="relative flex min-h-screen items-center justify-center text-white">
        <p className="text-sm text-white/70">You’re already in the app — opening Focus…</p>
      </main>
    );
  }

  const ready = Boolean(info?.windowsUrl);
  const label = ready
    ? `Download for Windows${info?.version ? ` · ${info.version}` : ""}`
    : info === null
      ? "Checking build…"
      : "Build coming soon";

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <ImmersiveScene scene={DOWNLOAD_SCENE} />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-16">
        <Link href="/" className="mb-8 inline-block text-sm text-white/70 hover:text-white">
          ← Back to the web app
        </Link>

        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
          Optional · Windows desktop
        </p>
        <h1 className="mb-4 font-display text-4xl font-bold drop-shadow-lg md:text-5xl">
          Download for <span className="accent-text">Windows</span>
        </h1>
        <p className="mb-10 text-lg text-white/75">
          Already using the web app? You can keep going here. The desktop app adds system-wide
          blocking (outside Chrome) and a float timer.
        </p>

        <div className="glass-panel mb-8 p-8 text-center">
          {ready ? (
            <a href="/api/download/windows" className="btn-primary inline-block min-w-[280px]" download>
              {label}
            </a>
          ) : (
            <button type="button" disabled className="btn-primary inline-block min-w-[280px] opacity-50">
              {label}
            </button>
          )}
          {!ready && info !== null && (
            <p className="mt-4 text-sm text-white/60">
              Installer not published yet — use the web app, or run desktop source locally.
            </p>
          )}
          <p className="mt-3 text-xs text-white/50">Windows 10/11 · optional upgrade from the browser</p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[#e07a63] hover:underline">
            Continue in the web app →
          </Link>
        </div>

        <ol className="glass-panel space-y-4 p-8 text-sm text-white/75">
          <li>
            <strong className="text-white">1.</strong> Install & launch Fellowship Focus
          </li>
          <li>
            <strong className="text-white">2.</strong> Open Block → Turn Shield ON
          </li>
          <li>
            <strong className="text-white">3.</strong> Start a focus quest
          </li>
        </ol>
      </div>
    </main>
  );
}
