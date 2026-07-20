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
          <Link href="/download" className="btn-primary block w-full text-center">
            Download for Windows — block sites & start 45-min focus
          </Link>
        </div>

        <form
          onSubmit={createFellowship}
          className="glass-card animate-fade-up stagger-3 w-full max-w-md p-8"
        >
          <p className="mb-4 text-center text-xs uppercase tracking-widest text-stone-500">
            Or start in the browser
          </p>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-stone-500">
            Name your Fellowship
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Nine Walkers"
            className="input-premium mb-5 w-full"
          />
          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn-secondary w-full">
            {loading ? "Forging the Ring…" : "Create Fellowship (web)"}
          </button>
        </form>

        <div className="mt-14 grid w-full max-w-4xl gap-5 md:grid-cols-3">
          {[
            {
              img: FEATURE_IMAGES.focus,
              title: "Block everything",
              desc: "Desktop app blocks dopamine sites in all browsers during focus.",
            },
            {
              img: FEATURE_IMAGES.link,
              title: "One guild link",
              desc: "Share with friends. OKRs, habits, stakes, Guild Trust.",
            },
            {
              img: FEATURE_IMAGES.ladder,
              title: "XP & ladder",
              desc: "45–50 min quests (flexible). Windows notifications when done.",
            },
          ].map((card, i) => (
            <div
              key={card.title}
              className={`glass-card group overflow-hidden opacity-0 animate-fade-up ${["stagger-1", "stagger-2", "stagger-3"][i]}`}
            >
              <div className="relative h-36 overflow-hidden">
                <Image
                  src={card.img}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <p className="font-display absolute bottom-3 left-4 text-lg font-semibold text-amber-300">
                  {card.title}
                </p>
              </div>
              <p className="p-4 text-sm leading-relaxed text-stone-400">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
