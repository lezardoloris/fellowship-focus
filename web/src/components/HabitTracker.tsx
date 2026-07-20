"use client";

import { useCallback, useEffect, useState } from "react";
import { HABIT_PRESETS, getMonthDays, verificationBadge } from "@/lib/habits";

type HabitRow = {
  id: string;
  label: string;
  emoji: string;
  verification: string;
  goal: number;
  achieved: number;
  completionRate: number;
  checkins: Record<string, { completed: boolean; verified_by: string }>;
};

type HabitData = {
  presets: typeof HABIT_PRESETS;
  grid: HabitRow[];
  year: number;
  month: number;
};

export function HabitTracker({ token, fellowshipCode }: { token: string; fellowshipCode: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<HabitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/habits?token=${token}&year=${year}&month=${month}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [token, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleDay(habitId: string, date: string, verification: string) {
    if (verification !== "manual") return;
    await fetch("/api/habits/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, habitId, date }),
    });
    await load();
  }

  async function addPreset(presetId: string) {
    setAdding(true);
    await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, presetId }),
    });
    setAdding(false);
    await load();
  }

  if (loading) return <p className="text-stone-500">Loading habits…</p>;
  if (!data) return <p className="text-red-400">Could not load habits</p>;

  const daysInMonth = getMonthDays(year, month);
  const monthLabel = new Date(year, month - 1).toLocaleString("fr-FR", { month: "long", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);
  const myPresetIds = new Set(data.grid.map((h) => HABIT_PRESETS.find((p) => p.label === h.label)?.id));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Habit tracker</h2>
          <p className="text-xs text-stone-500">
            Inspiré de PERSO.xlsx — grille mensuelle · objectif vs réalisé · potes voient tout sur /f/{fellowshipCode}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-[#3a3d40] px-3 py-1 text-sm text-[#9ca3af] hover:border-[#9ca3af]"
            onClick={() => {
              const m = month === 1 ? 12 : month - 1;
              const y = month === 1 ? year - 1 : year;
              setMonth(m);
              setYear(y);
              setLoading(true);
            }}
          >
            ←
          </button>
          <span className="px-2 py-1 text-sm capitalize text-[#f4f4f5]">{monthLabel}</span>
          <button
            type="button"
            className="rounded-lg border border-[#3a3d40] px-3 py-1 text-sm text-[#9ca3af] hover:border-[#9ca3af]"
            onClick={() => {
              const m = month === 12 ? 1 : month + 1;
              const y = month === 12 ? year + 1 : year;
              setMonth(m);
              setYear(y);
              setLoading(true);
            }}
          >
            →
          </button>
        </div>
      </div>

      {data.grid.length === 0 ? (
        <p className="text-stone-500">Aucune habitude. Ajoute-en depuis les presets PERSO ci-dessous.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-stone-500">
                <th className="sticky left-0 bg-[#242628] py-2 pr-3 text-left font-normal">Habitude</th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th key={i} className="w-6 px-0.5 py-2 font-normal">
                    {i + 1}
                  </th>
                ))}
                <th className="px-2 py-2 font-normal">Goal</th>
                <th className="px-2 py-2 font-normal">Done</th>
                <th className="px-2 py-2 font-normal">%</th>
              </tr>
            </thead>
            <tbody>
              {data.grid.map((habit) => {
                const badge = verificationBadge(habit.verification as "manual" | "auto_focus" | "auto_clean");
                return (
                  <tr key={habit.id} className="border-b border-white/5">
                    <td className="sticky left-0 bg-[#242628] py-2 pr-3">
                      <span className="mr-1">{habit.emoji}</span>
                      <span className="text-stone-300">{habit.label}</span>
                      <span className={`ml-1 ${badge.color}`}>({badge.label})</span>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                      const cell = habit.checkins[d];
                      const done = cell?.completed;
                      const isFuture = d > today;
                      const isManual = habit.verification === "manual";
                      return (
                        <td key={d} className="px-0.5 py-1 text-center">
                          <button
                            type="button"
                            disabled={isFuture || !isManual}
                            onClick={() => toggleDay(habit.id, d, habit.verification)}
                            className={`h-5 w-5 rounded ${
                              done
                                ? "bg-[#b8422e] text-white"
                                : isFuture
                                  ? "bg-white/5"
                                  : isManual
                                    ? "bg-white/10 hover:bg-white/20"
                                    : "bg-white/5"
                            } ${!isManual && done ? "ring-1 ring-green-500/50" : ""}`}
                            title={cell?.verified_by ?? habit.verification}
                          >
                            {done ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 text-center text-stone-500">{habit.goal}</td>
                    <td className="px-2 text-center font-semibold text-[#f4f4f5]">{habit.achieved}</td>
                    <td className="px-2 text-center text-stone-400">{habit.completionRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-600">Ajouter depuis PERSO.xlsx</p>
        <div className="flex flex-wrap gap-2">
          {HABIT_PRESETS.filter((p) => !myPresetIds.has(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={adding}
              onClick={() => addPreset(p.id)}
              className="rounded-full border border-[#3a3d40] px-3 py-1 text-xs text-[#9ca3af] hover:border-[#9ca3af] hover:text-[#f4f4f5]"
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
