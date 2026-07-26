"use client";

import Image from "next/image";
import { WAYPOINT_IMAGES } from "@/lib/assets";
import { WAYPOINTS, type Waypoint } from "@/lib/waypoints";
import { titleForWaypoint } from "@/lib/guildRank";

export function GuildJourney({
  totalXp,
  current,
  next,
  progress,
}: {
  totalXp: number;
  current: Waypoint;
  next: Waypoint | null;
  progress: number;
}) {
  const journeyImage = WAYPOINT_IMAGES[current.id] ?? "/assets/journey-map.jpg";

  return (
    <div className="hud-panel overflow-hidden p-0" data-augmented-ui="tl-clip br-clip both">
      <div className="relative h-44 w-full md:h-52">
        <Image src={journeyImage} alt="" fill className="object-cover opacity-75" />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] pp-title">Journey</p>
          <h2 className="font-display mt-1 text-2xl font-bold pp-strong">{current.name}</h2>
          <p className="text-sm pp-muted">{current.storyTitle}</p>
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <p className="max-w-xl text-sm leading-relaxed pp-muted">{current.story}</p>
          <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-medium pp-strong">
            {totalXp.toLocaleString()} XP
          </span>
        </div>

        {next && (
          <div className="mb-6">
            <div className="mb-2 flex justify-between text-xs pp-muted">
              <span>
                Next · {next.name}
                <span className="ml-2 pp-faint">({titleForWaypoint(next)})</span>
              </span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-xs pp-faint">
              {(next.xpRequired - totalXp).toLocaleString()} XP to unlock
            </p>
          </div>
        )}

        {/* Frieze */}
        <div className="guild-frieze relative flex gap-1 overflow-x-auto pb-2">
          {WAYPOINTS.map((wp, i) => {
            const reached = totalXp >= wp.xpRequired;
            const isCurrent = wp.id === current.id;
            return (
              <div
                key={wp.id}
                className={`guild-frieze-node relative flex min-w-[4.5rem] flex-1 flex-col items-center ${
                  isCurrent ? "guild-frieze-current" : ""
                }`}
                title={`${wp.name} · ${titleForWaypoint(wp)}`}
              >
                {i < WAYPOINTS.length - 1 && (
                  <div
                    className={`absolute left-1/2 top-3 h-0.5 w-full ${
                      totalXp >= WAYPOINTS[i + 1].xpRequired ? "bg-[#b8422e]/60" : "bg-white/10"
                    }`}
                    aria-hidden
                  />
                )}
                <div
                  className={`relative z-[1] flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                    reached
                      ? "border-[#b8422e] bg-[#b8422e]/30 pp-strong"
                      : "border-white/20 bg-black/40 pp-faint"
                  } ${isCurrent ? "ring-2 ring-[#b8422e]/50 ring-offset-2 ring-offset-[#0c0e10]" : ""}`}
                >
                  {i + 1}
                </div>
                <p
                  className={`mt-2 text-center text-[10px] leading-tight ${
                    reached ? "pp-body" : "pp-faint"
                  }`}
                >
                  {wp.name}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] pp-faint">
          Unlocked title · <span className="accent-text">{titleForWaypoint(current)}</span>
          <span className="pp-faint"> · {current.unlock}</span>
        </p>
      </div>
    </div>
  );
}
