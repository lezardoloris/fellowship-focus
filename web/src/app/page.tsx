"use client";

import Image from "next/image";
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

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-20">
        <p className="animate-fade-up mb-3 text-xs font-semibold uppercase tracking-[0.45em] text-amber-400/80">
          Duolingo for deep work
        </p>
        <h1 className="font-display animate-fade-up stagger-1 mb-5 text-center text-5xl font-bold tracking-wide md:text-7xl">
          <span className="gold-text">Fellowship</span>
          <br />
          <span className="text-stone-100">Focus</span>
        </h1>
        <p className="animate-fade-up stagger-2 mb-12 max-w-xl text-center text-lg leading-relaxed text-stone-400">
          Block distractions. Complete daily focus quests. March your Fellowship from the Shire to
          Mount Doom — one link for all your friends.
        </p>

        <form
          onSubmit={createFellowship}
          className="glass-card animate-fade-up stagger-3 w-full max-w-md p-8"
        >
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
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Forging the Ring…" : "Begin the Journey"}
          </button>
        </form>

        <div className="mt-16 grid w-full max-w-4xl gap-5 md:grid-cols-3">
          {[
            {
              img: FEATURE_IMAGES.link,
              title: "One link",
              desc: "Share with friends. Everyone tracks focus on the same map.",
            },
            {
              img: FEATURE_IMAGES.focus,
              title: "Block & focus",
              desc: "Desktop app blocks dopamine sites system-wide during Pomodoro.",
            },
            {
              img: FEATURE_IMAGES.ladder,
              title: "Weekly ladder",
              desc: "Compete on focus XP. Co-op on the journey. Duolingo-style streaks.",
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
