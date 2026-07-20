"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DownloadInfo = {
  version: string | null;
  available: boolean;
  windowsUrl: string | null;
  filename: string | null;
};

export default function DownloadPage() {
  const [info, setInfo] = useState<DownloadInfo | null>(null);

  useEffect(() => {
    fetch("/api/download/latest")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ version: null, available: false, windowsUrl: null, filename: null }));
  }, []);

  const ready = Boolean(info?.windowsUrl);
  const label = ready
    ? `Download for Windows${info?.version ? ` · ${info.version}` : ""}`
    : info === null
      ? "Checking build…"
      : "Build coming soon";

  return (
    <main className="min-h-screen bg-[#1a1c1e]">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link href="/" className="mb-8 inline-block text-sm text-[#9ca3af] hover:text-[#f4f4f5]">
          ← Back
        </Link>

        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#9ca3af]">Step 1 of 3</p>
        <h1 className="mb-4 text-4xl font-bold text-[#f4f4f5] md:text-5xl">
          Download for <span className="accent-text">Windows</span>
        </h1>
        <p className="mb-10 text-lg text-[#9ca3af]">
          Block Twitter, YouTube, TikTok system-wide. Focus timer with Windows notifications.
          Sync XP with your Fellowship on the web — no GitHub account needed.
        </p>

        <div className="glass-card mb-8 p-8 text-center">
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
            <p className="mt-4 text-sm text-[#9ca3af]">
              The Windows installer is not published yet. Use the web app for now, or run the desktop source locally.
            </p>
          )}
          <p className="mt-3 text-xs text-[#9ca3af]">Windows 10/11 · direct download · no account required</p>
        </div>

        <ol className="glass-card space-y-6 p-8">
          {[
            {
              n: "1",
              title: "Install & open Fellowship Focus",
              desc: "Run the installer. Certificate setup once in Blocker tab (2 min).",
            },
            {
              n: "2",
              title: "Connect your Fellowship",
              desc: "Settings → paste invite link or “Copy for desktop app” from the web dashboard.",
            },
            {
              n: "3",
              title: "Start a focus session",
              desc: "Pomodoro blocks distractions. OKRs + Guild Trust track progress. Adjust timer anytime.",
            },
          ].map((step) => (
            <li key={step.n} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#3a3d40] text-sm font-semibold text-[#f4f4f5]">
                {step.n}
              </span>
              <div>
                <p className="font-semibold text-[#f4f4f5]">{step.title}</p>
                <p className="text-sm text-[#9ca3af]">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <details className="glass-card mt-6 p-6">
          <summary className="cursor-pointer font-medium text-[#f4f4f5]">Run from source (developers)</summary>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-[#2e3134] p-4 text-xs text-[#9ca3af]">
{`cd desktop
pip install -r requirements.txt
python main.py`}
          </pre>
        </details>
      </div>
    </main>
  );
}
