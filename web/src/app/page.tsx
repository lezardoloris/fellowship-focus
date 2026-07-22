"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImmersiveScene } from "@/components/ImmersiveScene";
import { LANDING_SCENE } from "@/lib/scenes";

export default function HomePage() {
  const [name, setName] = useState("");
  const [penaltyEnabled, setPenaltyEnabled] = useState(false);
  const [blockerPenalty, setBlockerPenalty] = useState(25);
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
        body: JSON.stringify({
          name: name || "The Fellowship",
          blockerBypassPenalty: penaltyEnabled ? blockerPenalty : 0,
        }),
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
    <main className="relative min-h-screen overflow-hidden text-white">
      <ImmersiveScene scene={LANDING_SCENE} />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-20">
        <p className="font-display text-xs font-semibold tracking-[0.35em] text-white/70">
          FELLOWSHIP FOCUS
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold drop-shadow-lg md:text-6xl">
          Block distractions.
          <br />
          <span className="accent-text">Keep the quest.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/75 drop-shadow">
          Immersive focus for builders. Shield, timer, guild — over Middle-earth.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app" className="btn-primary">
            Open app
          </Link>
          <Link
            href="/download"
            className="btn-secondary border-white/20 bg-black/30 text-white backdrop-blur-md"
          >
            Windows download
          </Link>
        </div>

        <form onSubmit={createFellowship} className="glass-panel mt-12 space-y-4 p-6">
          <h2 className="text-lg font-semibold">Found a fellowship</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fellowship name"
            className="input-premium w-full bg-white/5"
          />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={penaltyEnabled}
              onChange={(e) => setPenaltyEnabled(e.target.checked)}
            />
            Bypass penalty ({blockerPenalty} XP)
          </label>
          {penaltyEnabled && (
            <input
              type="range"
              min={5}
              max={100}
              value={blockerPenalty}
              onChange={(e) => setBlockerPenalty(Number(e.target.value))}
              className="w-full accent-[#b8422e]"
            />
          )}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "…" : "Create"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </div>
    </main>
  );
}
