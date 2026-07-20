"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type DownloadInfo = {
  version: string | null;
  windowsUrl: string | null;
  releasesPage: string;
};

export default function DownloadPage() {
  const [info, setInfo] = useState<DownloadInfo | null>(null);

  useEffect(() => {
    fetch("/api/download/latest")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() =>
        setInfo({
          version: null,
          windowsUrl: null,
          releasesPage: "https://github.com/lezardoloris/fellowship-focus/releases/latest",
        })
      );
  }, []);

  const downloadHref = info?.windowsUrl ?? info?.releasesPage;
  const hasExe = Boolean(info?.windowsUrl);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Image src="/assets/hero.jpg" alt="" fill priority className="object-cover object-center" />
        <div className="hero-overlay absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-16">
        <Link href="/" className="mb-8 inline-block text-sm text-stone-500 hover:text-amber-400">
          ← Back
        </Link>

        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-400/80">Step 1 of 3</p>
        <h1 className="font-display mb-4 text-4xl font-bold text-white md:text-5xl">
          Download for <span className="gold-text">Windows</span>
        </h1>
        <p className="mb-10 text-lg text-stone-400">
          Block Twitter, YouTube, TikTok system-wide. Focus timer with Windows notifications.
          Sync XP with your Fellowship on the web.
        </p>

        <div className="glass-card mb-8 p-8 text-center">
          <a
            href={downloadHref ?? "#"}
            className="btn-primary inline-block min-w-[280px]"
            target={hasExe ? undefined : "_blank"}
            rel={hasExe ? undefined : "noopener noreferrer"}
          >
            {hasExe ? `Download v${info?.version}` : "Get Windows build (GitHub)"}
          </a>
          {!hasExe && (
            <p className="mt-4 text-sm text-stone-500">
              First release building — meanwhile use GitHub Releases or run from source below.
            </p>
          )}
          <p className="mt-3 text-xs text-stone-600">Windows 10/11 · ~80 MB · No account required to install</p>
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
              title: "Start a 45-min focus quest",
              desc: "Pomodoro blocks distractions. OKRs + Guild Trust track progress. Adjust timer anytime.",
            },
          ].map((step) => (
            <li key={step.n} className="flex gap-4">
              <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/40 text-amber-400">
                {step.n}
              </span>
              <div>
                <p className="font-semibold text-stone-200">{step.title}</p>
                <p className="text-sm text-stone-500">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <details className="glass-card mt-6 p-6">
          <summary className="cursor-pointer font-medium text-stone-300">Run from source (developers)</summary>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-stone-400">
{`cd desktop
pip install -r requirements.txt
python main.py`}
          </pre>
        </details>
      </div>
    </main>
  );
}
