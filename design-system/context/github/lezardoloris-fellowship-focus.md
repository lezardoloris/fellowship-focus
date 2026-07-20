# GitHub Design Evidence: lezardoloris/fellowship-focus

Source: https://github.com/lezardoloris/fellowship-focus
Read method: git-clone
Local clone method: git clone
Ref: default branch
Repository paths discovered: 97
Snapshot files written: 47

## Intake Status

- This-device intake was used through local git or GitHub CLI.

## README (README.md)

```md
# Fellowship Focus

> Duolingo for deep work. One link. March to Mordor with friends.

## Two parts

| Part | What | Chrome needed? |
|------|------|----------------|
| **`web/`** | Fellowship dashboard, invite link, ladder, map | No |
| **`desktop/`** | Koncentro-style system-wide blocker + Pomodoro | **No** |

The **desktop app** uses the same technique as Koncentro:
- **mitmproxy certificate** (the "contract" you install once)
- **System proxy** during focus sessions
- Blocks sites in **all browsers**, not just Chrome

## Quick start

### Web dashboard
```bash
cd web && npm install && npm run dev
```
Open http://localhost:3000 → create Fellowship → share link → join with friends

### Desktop blocker (no extension)
```bash
cd desktop && pip install -r requirements.txt && python main.py
```

1. **Certificate** tab → install mitmproxy cert (skip if you already did for Koncentro)
2. **Settings** → API URL + member token + Fellowship code
3. **Begin Quest** → system-wide blocking + XP sync

See [desktop/README.md](./desktop/README.md), [PLAN.md](./PLAN.md), and [DEPLOY.md](./DEPLOY.md) for Railway deployment.

```

## Source Evidence Inventory

### Product docs and manifests

Use these to understand product purpose, dependency stack, scripts, and public naming.

- desktop/README.md -> `context/github/lezardoloris-fellowship-focus/files/desktop/README.md` (source)
- web/README.md -> `context/github/lezardoloris-fellowship-focus/files/web/README.md` (source)
- package.json -> `context/github/lezardoloris-fellowship-focus/files/package.json` (source)
- web/package.json -> `context/github/lezardoloris-fellowship-focus/files/web/package.json` (source)

### Theme, tokens, and styling

Extract concrete color, typography, spacing, radius, shadow, and theme-variable values from these files.

- web/src/app/globals.css -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/globals.css` (source)

### App shell and navigation

Use these to recreate the product frame, navigation density, sidebars, window chrome, and layout rhythm.

- web/src/app/layout.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/layout.tsx` (source)
- web/src/app/page.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/page.tsx` (source)
- web/src/app/api/blocks/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/blocks/route.ts` (source)
- web/src/app/api/download/latest/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/download/latest/route.ts` (source)
- web/src/app/api/fellowship/[code]/join/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/fellowship/code/join/route.ts` (source)
- web/src/app/api/fellowship/[code]/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/fellowship/code/route.ts` (source)
- web/src/app/api/fellowship/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/fellowship/route.ts` (source)
- web/src/app/api/habits/checkin/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/habits/checkin/route.ts` (source)
- web/src/app/api/habits/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/habits/route.ts` (source)
- web/src/app/api/proofs/[id]/thumb/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/proofs/id/thumb/route.ts` (source)
- web/src/app/api/proofs/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/proofs/route.ts` (source)
- web/src/app/api/sessions/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/sessions/route.ts` (source)
- web/src/app/api/sessions/start/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/sessions/start/route.ts` (source)
- web/src/app/api/stakes/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/stakes/route.ts` (source)
- web/src/app/blocked/page.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/blocked/page.tsx` (source)
- web/src/app/download/page.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/download/page.tsx` (source)
- web/src/app/f/[code]/page.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/f/code/page.tsx` (source)

### Reusable components

Use these to derive buttons, inputs, cards, dialogs, avatars, selectors, menus, and feedback states.

- desktop/fellowship_focus/ui/__init__.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/__init__.py` (source)
- desktop/fellowship_focus/ui/dashboard.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/dashboard.py` (source)
- desktop/fellowship_focus/ui/main_window.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/main_window.py` (source)
- desktop/fellowship_focus/ui/theme.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/theme.py` (source)
- desktop/fellowship_focus/ui/toast.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/toast.py` (source)
- desktop/fellowship_focus/ui/web_dashboard.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/web_dashboard.py` (source)
- web/src/components/FellowshipDashboard.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/components/FellowshipDashboard.tsx` (source)
- web/src/components/HabitTracker.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/components/HabitTracker.tsx` (source)
- web/src/components/StakesPanel.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/components/StakesPanel.tsx` (source)
- web/src/components/TrustPanel.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/components/TrustPanel.tsx` (source)

### Other design evidence

Inspect these only after the primary design evidence above has been used.

- desktop/fellowship_focus/__init__.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/__init__.py` (source)
- desktop/fellowship_focus/api_client.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/api_client.py` (source)
- desktop/fellowship_focus/blocker/__init__.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/__init__.py` (source)
- desktop/fellowship_focus/blocker/block_page.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/block_page.py` (source)
- desktop/fellowship_focus/blocker/block.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/block.py` (source)
- desktop/fellowship_focus/blocker/constants.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/constants.py` (source)
- desktop/fellowship_focus/blocker/manager.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/manager.py` (source)
- desktop/fellowship_focus/cert_setup.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/cert_setup.py` (source)
- desktop/fellowship_focus/config.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/config.py` (source)
- desktop/fellowship_focus/constants.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/constants.py` (source)
- desktop/fellowship_focus/invite.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/invite.py` (source)
- desktop/fellowship_focus/notifications.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/notifications.py` (source)
- desktop/fellowship_focus/points.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/points.py` (source)
- desktop/fellowship_focus/pomodoro_engine.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/pomodoro_engine.py` (source)
- desktop/fellowship_focus/proof_capture.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/proof_capture.py` (source)


## Files Inspected

- web/src/app/layout.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/layout.tsx` (864 bytes, git-clone)
- web/src/app/globals.css -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/globals.css` (4523 bytes, git-clone)
- web/src/app/page.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/page.tsx` (5157 bytes, git-clone)
- desktop/README.md -> `context/github/lezardoloris-fellowship-focus/files/desktop/README.md` (1277 bytes, git-clone)
- web/README.md -> `context/github/lezardoloris-fellowship-focus/files/web/README.md` (1486 bytes, git-clone)
- desktop/fellowship_focus/ui/__init__.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/__init__.py` (0 bytes, git-clone)
- desktop/fellowship_focus/ui/dashboard.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/dashboard.py` (10243 bytes, git-clone)
- desktop/fellowship_focus/ui/main_window.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/main_window.py` (38645 bytes, git-clone)
- desktop/fellowship_focus/ui/theme.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/theme.py` (5314 bytes, git-clone)
- desktop/fellowship_focus/ui/toast.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/toast.py` (3420 bytes, git-clone)
- desktop/fellowship_focus/ui/web_dashboard.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/ui/web_dashboard.py` (8376 bytes, git-clone)
- package.json -> `context/github/lezardoloris-fellowship-focus/files/package.json` (280 bytes, git-clone)
- web/package.json -> `context/github/lezardoloris-fellowship-focus/files/web/package.json` (948 bytes, git-clone)
- web/src/app/api/blocks/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/blocks/route.ts` (1301 bytes, git-clone)
- web/src/app/api/download/latest/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/download/latest/route.ts` (1289 bytes, git-clone)
- web/src/app/api/fellowship/[code]/join/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/fellowship/code/join/route.ts` (924 bytes, git-clone)
- web/src/app/api/fellowship/[code]/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/fellowship/code/route.ts` (1634 bytes, git-clone)
- web/src/app/api/fellowship/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/fellowship/route.ts` (500 bytes, git-clone)
- web/src/app/api/habits/checkin/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/habits/checkin/route.ts` (1166 bytes, git-clone)
- web/src/app/api/habits/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/habits/route.ts` (2076 bytes, git-clone)
- web/src/app/api/proofs/[id]/thumb/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/proofs/id/thumb/route.ts` (1591 bytes, git-clone)
- web/src/app/api/proofs/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/proofs/route.ts` (1868 bytes, git-clone)
- web/src/app/api/sessions/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/sessions/route.ts` (1314 bytes, git-clone)
- web/src/app/api/sessions/start/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/sessions/start/route.ts` (1145 bytes, git-clone)
- web/src/app/api/stakes/route.ts -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/api/stakes/route.ts` (3446 bytes, git-clone)
- web/src/app/blocked/page.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/blocked/page.tsx` (1649 bytes, git-clone)
- web/src/app/download/page.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/download/page.tsx` (4157 bytes, git-clone)
- web/src/app/f/[code]/page.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/app/f/code/page.tsx` (268 bytes, git-clone)
- web/src/components/FellowshipDashboard.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/components/FellowshipDashboard.tsx` (16956 bytes, git-clone)
- web/src/components/HabitTracker.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/components/HabitTracker.tsx` (8001 bytes, git-clone)
- web/src/components/StakesPanel.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/components/StakesPanel.tsx` (5445 bytes, git-clone)
- web/src/components/TrustPanel.tsx -> `context/github/lezardoloris-fellowship-focus/files/web/src/components/TrustPanel.tsx` (2109 bytes, git-clone)
- desktop/fellowship_focus/__init__.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/__init__.py` (0 bytes, git-clone)
- desktop/fellowship_focus/api_client.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/api_client.py` (2609 bytes, git-clone)
- desktop/fellowship_focus/blocker/__init__.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/__init__.py` (0 bytes, git-clone)
- desktop/fellowship_focus/blocker/block_page.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/block_page.py` (3977 bytes, git-clone)
- desktop/fellowship_focus/blocker/block.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/block.py` (3180 bytes, git-clone)
- desktop/fellowship_focus/blocker/constants.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/constants.py` (717 bytes, git-clone)
- desktop/fellowship_focus/blocker/manager.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/blocker/manager.py` (3231 bytes, git-clone)
- desktop/fellowship_focus/cert_setup.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/cert_setup.py` (2234 bytes, git-clone)
- desktop/fellowship_focus/config.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/config.py` (1831 bytes, git-clone)
- desktop/fellowship_focus/constants.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/constants.py` (1483 bytes, git-clone)
- desktop/fellowship_focus/invite.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/invite.py` (1879 bytes, git-clone)
- desktop/fellowship_focus/notifications.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/notifications.py` (681 bytes, git-clone)
- desktop/fellowship_focus/points.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/points.py` (902 bytes, git-clone)
- desktop/fellowship_focus/pomodoro_engine.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/pomodoro_engine.py` (3858 bytes, git-clone)
- desktop/fellowship_focus/proof_capture.py -> `context/github/lezardoloris-fellowship-focus/files/desktop/fellowship_focus/proof_capture.py` (2400 bytes, git-clone)

## Design-Relevant Excerpts

### web/src/app/layout.tsx

```tsx
import type { Metadata } from "next";
import { Cinzel, DM_Sans } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fellowship Focus — March to Mordor",
  description: "Premium focus app. Block distractions, march with friends from the Shire to Mount Doom.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

```

### web/src/app/globals.css

```css
@import "tailwindcss";

:root {
  --background: #060806;
  --foreground: #f0ebe0;
  --gold: #d4af37;
  --gold-light: #f0d878;
  --gold-dim: #8a7020;
  --forest: #0f1a0f;
  --ember: #c45c26;
  --mist: #1a2418;
  --glass: rgba(12, 18, 12, 0.72);
  --glass-border: rgba(212, 175, 55, 0.18);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-dm-sans);
  --font-display: var(--font-cinzel);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-dm-sans), system-ui, sans-serif;
  min-height: 100vh;
}

.font-display {
  font-family: var(--font-cinzel), Georgia, serif;
}

.gold-text {
  background: linear-gradient(135deg, var(--gold-light), var(--gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.glass-card {
  background: var(--glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.glass-card:hover {
  border-color: rgba(212, 175, 55, 0.35);
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(212, 175, 55, 0.08);
}

.btn-primary {
  background: linear-gradient(135deg, #d4af37 0%, #8a7020 50%, #d4af37 100%);
  background-size: 200% auto;
  color: #0a0a08;
  font-weight: 700;
  padding: 0.875rem 1.75rem;
  border-radius: 10px;
  border: none;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.8rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(212, 175, 55, 0.25);
}

.btn-primary:hover:not(:disabled) {
  background-position: right center;
  box-shadow: 0 6px 28px rgba(212, 175, 55, 0.4);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: #d4af37;
  font-weight: 600;
  padding: 0.875rem 1.75rem;
  border-radius: 10px;
  border: 1px solid rgba(212, 175, 55, 0.45);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.btn-secondary:hover:not(:disabled) {
  border-color: #d4af37;
  background: rgba(212, 175, 55, 0.08);
...
```

### web/src/app/page.tsx

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FEATURE_IMAGES } from "@/lib/assets";

export default function HomePage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function createFellowship(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/fellowship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "The Fellowship" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      router.push(`/f/${data.fellowship.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/assets/hero.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center scale-105"
        />
        <div className="hero-overlay absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-16">
        <p className="animate-fade-up mb-3 text-xs font-semibold uppercase tracking-[0.45em] text-amber-400/80">
          Block · Focus · Win XP with friends
        </p>
        <h1 className="font-display animate-fade-up stagger-1 mb-5 text-center text-5xl font-bold tracking-wide md:text-7xl">
          <span className="gold-text">Fellowship</span>
          <br />
          <span className="text-stone-100">Focus</span>
        </h1>
        <p className="animate-fade-up stagger-2 mb-8 max-w-xl text-center text-lg leading-relaxed text-stone-400">
          System-wide blocker for Twitter, YouTube, TikTok. 45-min focus quests. Weekly ladder with your guild.
        </p>

        <div className="animate-fade-up stagger-3 mb-10 w-full max-w-md">
          <Link href="/download" className="btn-primary block
...
```

### desktop/README.md

```
# Fellowship Focus Desktop

Koncentro-style **system-wide website blocker** (mitmproxy certificate + system proxy) — **no Chrome extension**.

## How it works (same as Koncentro)

1. **mitmdump** intercepts HTTP/HTTPS traffic
2. **mitmproxy CA certificate** installed in Windows (the "contract" Koncentro asks for)
3. **uniproxy** sets Windows system proxy during focus sessions
4. Blocked sites show "You cannot pass." in **any browser**

## Setup

```bash
cd desktop
pip install -r requirements.txt
python main.py
```

### First run

1. Open **Certificate** tab
2. **Generate certificate** (if not already from Koncentro)
3. **Install certificate** → same as Koncentro setup
4. **Settings** tab → paste API URL, token, Fellowship code from web dashboard
5. **Begin Quest** → blocking active system-wide

## mitmdump source

Uses Koncentro's bundled `mitmdump.exe` if installed, otherwise `pip install mitmproxy`.

Your Koncentro certificate (`~/.mitmproxy/`) works here too — no need to reinstall.

## System tray

Closing the window minimizes to tray (like Koncentro). Blocking continues during active quests.

## Sync

Sessions and blocked-site attempts sync to the Fellowship web API (same as before, but without Chrome).

```

### web/README.md

```
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

```

### desktop/fellowship_focus/ui/__init__.py

```

```

### desktop/fellowship_focus/ui/dashboard.py

```
"""Dashboard — KPIs, OKRs, guild ladder preview (web parity)."""

from PySide6.QtGui import QFont
from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import (
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from fellowship_focus.ui.theme import ASSETS_DIR, font_display, font_sans


def _kpi_card(title: str, value: str, subtitle: str = "") -> QWidget:
    card = QWidget()
    card.setObjectName("kpiCard")
    layout = QVBoxLayout(card)
    layout.setContentsMargins(16, 14, 16, 14)
    t = QLabel(title.upper())
    t.setObjectName("kpiLabel")
    t.setFont(font_sans(10))
    v = QLabel(value)
    v.setObjectName("kpiValue")
    v.setFont(font_display(26, bold=True))
    layout.addWidget(t)
    layout.addWidget(v)
    if subtitle:
        s = QLabel(subtitle)
        s.setStyleSheet("color: #666; font-size: 11px;")
        s.setFont(font_sans(11))
        layout.addWidget(s)
    return card


def _okr_row(label: str, current: float, target: float, unit: str = "") -> QWidget:
    row = QWidget()
    layout = QVBoxLayout(row)
    layout.setContentsMargins(0, 0, 0, 8)
    pct = min(100, int((current / target) * 100)) if target > 0 else 0
    header = QHBoxLayout()
    header.addWidget(QLabel(label))
    header.addStretch()
    val = QLabel(f"{current:g}{unit} / {target:g}{unit} ({pct}%)")
    val.setStyleSheet("color: #d4af37; font-size: 11px;")
    header.addWidget(val)
    layout.addLayout(header)
    bar = QProgressBar()
    bar.setRange(0, 100)
    bar.setValue(pct)
    bar.setFixedHeight(8)
    layout.addWidget(bar)
    return row


class DashboardPage(QWidget):
    def __init__(self, on_start_pomo, on_open_web) -> None:
        super().__init__()
        self._on_start_pomo = on_start_pomo
        self._on_open_web = on_open_web

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        scroll.setStyleSheet("background: transparent; border: none;")

        content = QWidget()
        root = QVBoxLayout(content)
        root.setContentsMargins(20, 16, 20, 20)
        root.setSpacing(16)

        # Hero banner
        hero_wrap = QWidget()
        hero_wrap.setFixedHeight(140)
        hero_
...
```

### desktop/fellowship_focus/ui/main_window.py

```
import sys
import webbrowser
from pathlib import Path

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QAction, QCloseEvent, QIcon, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QFormLayout,
    QFrame,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QStackedWidget,
    QSystemTrayIcon,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from fellowship_focus.api_client import FellowshipApi
from fellowship_focus.blocker.manager import (
    find_mitmdump,
    set_system_proxy,
    shutdown_mitmdump_gracefully,
    start_mitmdump,
)
from fellowship_focus.cert_setup import install_cert_windows, is_cert_installed, is_cert_generated
from fellowship_focus.config import load_config, save_config
from fellowship_focus.invite import apply_parsed_config, parse_invite_or_sync
from fellowship_focus.constants import DEFAULT_BLOCKED_SITES
from fellowship_focus.notifications import notify
from fellowship_focus.pomodoro_engine import PomodoroEngine
from fellowship_focus.proof_worker import ProofWorker
from fellowship_focus.startup import is_startup_enabled, set_startup_enabled
from fellowship_focus.tasks import (
    add_task,
    delete_task,
    format_time,
    get_task,
    load_tasks,
    update_task,
)
from fellowship_focus.ui.dashboard import DashboardPage
from fellowship_focus.ui.theme import ASSETS_DIR, app_stylesheet, font_display, font_sans, font_timer, load_fonts
from fellowship_focus.ui.toast import ToastManager
from fellowship_focus.ui.web_dashboard import WebDashboardPage
from fellowship_focus.updater import apply_git_update, check_for_updates
from fellowship_focus.version import APP_VERSION


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.config = load_config()
        self.mitm_process = None
        self.blocker_active = False
        self.selected_task_id: str | None = None
        self.task_timer_seconds = 0
        self.task_tick = QTimer()
        self.task_tick.timeout.connect(self._on_task_tick)

        self.pomodoro = PomodoroEngine()
        self.proof_worker = ProofWorker(lambda: self.config)
        self.proof_worker.proof_sent.connect(lambda 
...
```

### desktop/fellowship_focus/ui/theme.py

```
"""Premium theme — matches web dashboard (Cinzel + DM Sans, glass, gold)."""

from pathlib import Path

from PySide6.QtGui import QFont, QFontDatabase

ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"

# Web parity colors
BG = "#060806"
FG = "#f0ebe0"
GOLD = "#d4af37"
GOLD_LIGHT = "#f0d878"
GOLD_DIM = "#8a7020"
GLASS = "rgba(12, 18, 12, 0.85)"
GLASS_BORDER = "rgba(212, 175, 55, 0.18)"
EMBER = "#c45c26"
GREEN = "#2d6a4f"
RED = "#9b2226"

_font_display = "Georgia"
_font_sans = "Segoe UI"
_fonts_loaded = False


def load_fonts() -> None:
    global _fonts_loaded, _font_display, _font_sans
    if _fonts_loaded:
        return
    _fonts_loaded = True
    mapping = {
        "Cinzel-Regular.ttf": "display",
        "Cinzel-Bold.ttf": "display_bold",
        "DMSans-Regular.ttf": "sans",
        "DMSans-Medium.ttf": "sans_medium",
        "DMSans-Bold.ttf": "sans_bold",
    }
    loaded: dict[str, str] = {}
    for fname, role in mapping.items():
        path = FONTS_DIR / fname
        if path.exists():
            fid = QFontDatabase.addApplicationFont(str(path))
            if fid >= 0:
                families = QFontDatabase.applicationFontFamilies(fid)
                if families:
                    loaded[role] = families[0]
    if "display" in loaded:
        _font_display = loaded["display"]
    if "sans" in loaded:
        _font_sans = loaded["sans"]


def font_display(size: int = 14, bold: bool = False) -> QFont:
    load_fonts()
    f = QFont(_font_display, size)
    f.setBold(bold)
    return f


def font_sans(size: int = 13, weight: int = QFont.Weight.Normal) -> QFont:
    load_fonts()
    f = QFont(_font_sans, size)
    f.setWeight(weight)
    return f


def font_timer(size: int = 56) -> QFont:
    load_fonts()
    f = QFont(_font_display, size)
    f.setBold(True)
    f.setLetterSpacing(QFont.SpacingType.AbsoluteSpacing, 2)
    return f


def app_stylesheet() -> str:
    return f"""
QMainWindow {{ background: {BG}; color: {FG}; }}
QWidget#contentArea {{ background: {BG}; color: {FG}; }}
QWidget#sidebarPanel {{
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #0f150f, stop:1 {BG});
    border-right: 1px solid {GLASS_BORDER};
}}
QWidget#glassCard {{
    background: rgba(12, 18, 12, 0.72);
    border: 1px solid {
...
```

### desktop/fellowship_focus/ui/toast.py

```
"""Bottom-right toast notifications — non-intrusive push-ups."""

from PySide6.QtGui import QFont
from PySide6.QtCore import QEasingCurve, QPropertyAnimation, Qt, QTimer
from PySide6.QtWidgets import QFrame, QGraphicsOpacityEffect, QLabel, QVBoxLayout, QWidget

from fellowship_focus.ui.theme import EMBER, GOLD, GREEN, font_sans


class Toast(QFrame):
  def __init__(self, parent: QWidget, title: str, message: str, kind: str = "info") -> None:
    super().__init__(parent)
    self.setObjectName("toast")
    border = GOLD
    if kind == "success":
      border = GREEN
    elif kind == "warning":
      border = EMBER
    elif kind == "danger":
      border = "#9b2226"

    self.setStyleSheet(f"""
      QFrame#toast {{
        background: rgba(12, 18, 12, 0.95);
        border: 1px solid {border};
        border-left: 4px solid {border};
        border-radius: 12px;
        min-width: 280px;
        max-width: 360px;
      }}
    """)

    layout = QVBoxLayout(self)
    layout.setContentsMargins(14, 12, 14, 12)
    layout.setSpacing(4)

    title_lbl = QLabel(title)
    title_lbl.setFont(font_sans(13, QFont.Weight.DemiBold))
    title_lbl.setStyleSheet(f"color: {border}; border: none;")
    layout.addWidget(title_lbl)

    msg_lbl = QLabel(message)
    msg_lbl.setWordWrap(True)
    msg_lbl.setFont(font_sans(12))
    msg_lbl.setStyleSheet("color: #ccc; border: none;")
    layout.addWidget(msg_lbl)

    self._effect = QGraphicsOpacityEffect(self)
    self.setGraphicsEffect(self._effect)
    self._effect.setOpacity(0.0)

  def show_animated(self, duration_ms: int = 4000) -> None:
    self.show()
    self.raise_()

    fade_in = QPropertyAnimation(self._effect, b"opacity")
    fade_in.setDuration(280)
    fade_in.setStartValue(0.0)
    fade_in.setEndValue(1.0)
    fade_in.setEasingCurve(QEasingCurve.Type.OutCubic)
    fade_in.start()
    self._fade_in = fade_in

    QTimer.singleShot(duration_ms, self._dismiss)

  def _dismiss(self) -> None:
    fade_out = QPropertyAnimation(self._effect, b"opacity")
    fade_out.setDuration(320)
    fade_out.setStartValue(1.0)
    fade_out.setEndValue(0.0)
    fade_out.setEasingCurve(QEasingCurve.Type.InCubic)
    fade_out.finished.connect(self.deleteLater)
    fade_out.start()
    self._fade_out = fade_out


class ToastManager:
  def __init__(self, parent:
...
```

### desktop/fellowship_focus/ui/web_dashboard.py

```
"""Embedded web dashboard — exact parity with localhost:3000 / Railway."""

from __future__ import annotations

import json

from PySide6.QtCore import QTimer, QUrl
from PySide6.QtWidgets import QHBoxLayout, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget

from fellowship_focus.invite import apply_parsed_config, parse_invite_or_sync
from fellowship_focus.ui.theme import font_display, font_sans

try:
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWebEngineCore import QWebEngineProfile

    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False


class WebDashboardPage(QWidget):
    def __init__(self, get_config, on_open_external, on_config_updated) -> None:
        super().__init__()
        self._get_config = get_config
        self._on_open_external = on_open_external
        self._on_config_updated = on_config_updated
        self._injected = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self._setup = QWidget()
        self._setup.setObjectName("webSetupBar")
        setup_layout = QVBoxLayout(self._setup)
        setup_layout.setContentsMargins(16, 12, 16, 12)

        self._title = QLabel("Connect your Fellowship")
        self._title.setFont(font_display(14, bold=True))
        self._title.setStyleSheet("color: #d4af37;")
        setup_layout.addWidget(self._title)

        self._hint = QLabel(
            "Paste your invite link from the browser (e.g. http://localhost:3000/f/greer-…)\n"
            "or use “Copy for desktop app” on the web dashboard."
        )
        self._hint.setWordWrap(True)
        self._hint.setFont(font_sans(11))
        self._hint.setStyleSheet("color: #888; margin-bottom: 6px;")
        setup_layout.addWidget(self._hint)

        row = QHBoxLayout()
        self._invite_input = QLineEdit()
        self._invite_input.setPlaceholderText("http://localhost:3000/f/your-fellowship-code")
        self._invite_input.returnPressed.connect(self._connect_from_input)
        row.addWidget(self._invite_input, 1)

        self._connect_btn = QPushButton("Connect")
        self._connect_btn.setObjectName("goldBtn")
        self._connect_btn.clicked.connect(self._connect_from_input)
        row.addWidget(self._connect_btn)

        self._open_btn = QPush
...
```

### package.json

```json
{
  "name": "fellowship-focus",
  "private": true,
  "description": "Monorepo: web dashboard (Next.js) + desktop blocker",
  "scripts": {
    "build": "npm run build --prefix web",
    "start": "npm run start --prefix web"
  },
  "engines": {
    "node": ">=22"
  }
}

```


## Package Files Materialized

- `source_examples/web/src/app/layout.tsx`
- `source_examples/web/src/app/api/blocks/route.ts`
- `source_examples/web/src/components/FellowshipDashboard.tsx`
- `source_examples/web/src/components/HabitTracker.tsx`
- `source_examples/web/src/components/StakesPanel.tsx`
- `source_examples/web/src/components/TrustPanel.tsx`

## Next Design-System Work

- Use these source paths and snapshots as evidence before writing `DESIGN.md`.
- Convert the inventory above into a Claude Design-style package: `README.md`, `SKILL.md`, `colors_and_type.css`, `preview/colors-*`, `preview/typography-specimens.html`, `preview/spacing-*`, `preview/components-*`, `preview/brand-assets.html`, `ui_kits/app/`, and preserved `assets/`, `build/`, or `fonts/` when evidence exists.
- `ui_kits/app/index.html` must be a browser-reviewable component entry: load `../../colors_and_type.css`, load or import at least three files from `ui_kits/app/components/`, and mount the composed UI through ReactDOM/Babel or compiled browser-ready JavaScript. Do not duplicate a static HTML mock when modular component files exist.
- `ui_kits/app/components/App.jsx` (or equivalent app shell) must compose source-backed role components such as Sidebar, AssistantsList, ChatArea, InputBar, and MessageBubble, not merely list their filenames.
- Claude-style UI-kit entry skeleton for direct JSX kits:
  - `<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>`
  - `<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>`
  - `<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>`
  - `<link rel="stylesheet" href="../../colors_and_type.css">`
  - `<div id="root"></div>`
  - Load role components from `components/*.jsx` with `<script type="text/babel" src="components/ComponentName.jsx"></script>`.
  - Mount with `const { App } = window; const root = ReactDOM.createRoot(document.getElementById("root")); root.render(<App />);`.
- Preserve at least three high-signal source examples outside `context/` under `source_examples/` when reusable component snapshots exist, so future agents can compare generated components against original source structure.
- When a captured asset path begins with `build/`, copy the snapshot back into a root `build/` path with its original filename, such as `context/.../files/build/icon.png` -> `build/icon.png`. Do not satisfy build/runtime icon evidence by only renaming those files into `assets/`.
- Make `preview/brand-assets.html` visibly load preserved asset files from `assets/` or `build/`; do not redraw captured logos/icons as inline placeholders.
- Extract concrete colors, typography, spacing, radius, component behavior, assets, and product tone only when supported by inspected files.
- If evidence is missing or ambiguous, mark that uncertainty instead of inventing tokens.
