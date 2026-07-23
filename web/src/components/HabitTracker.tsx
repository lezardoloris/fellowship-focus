"use client";

import { useCallback, useEffect, useState } from "react";
import { HABIT_PRESETS, getMonthDays, verificationBadge } from "@/lib/habits";
import {
  addSoloCustom,
  addSoloPreset,
  getSoloHabitGrid,
  listSoloHabits,
  removeSoloHabit,
  soloPresetIdsInUse,
  toggleSoloCheckin,
} from "@/lib/soloHabits";
import { PremiumLoader } from "@/components/PremiumLoader";

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

type Props = {
  /** Guild member token — when set, uses server API. Otherwise localStorage solo. */
  token?: string | null;
  fellowshipCode?: string | null;
};

export function HabitTracker({ token, fellowshipCode }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<HabitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customEmoji, setCustomEmoji] = useState("✨");
  const [customGoal, setCustomGoal] = useState(20);
  const solo = !token;

  const load = useCallback(async () => {
    setLoading(true);
    if (token) {
      const res = await fetch(`/api/habits?token=${token}&year=${year}&month=${month}`);
      if (res.ok) {
        const api = (await res.json()) as HabitData;
        // Custom (non-preset) activities live on-device until the API supports them.
        const soloRows = getSoloHabitGrid(year, month).filter(
          (h) => !HABIT_PRESETS.some((p) => p.label === h.label)
        );
        const apiLabels = new Set(api.grid.map((h) => h.label.toLowerCase()));
        setData({
          ...api,
          grid: [...api.grid, ...soloRows.filter((h) => !apiLabels.has(h.label.toLowerCase()))],
        });
      } else {
        setData({
          presets: HABIT_PRESETS,
          grid: getSoloHabitGrid(year, month),
          year,
          month,
        });
      }
    } else {
      setData({
        presets: HABIT_PRESETS,
        grid: getSoloHabitGrid(year, month),
        year,
        month,
      });
    }
    setLoading(false);
  }, [token, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleDay(habitId: string, date: string, verification: string) {
    if (verification !== "manual") return;
    const local = listSoloHabits().some((h) => h.id === habitId);
    if (token && !local) {
      await fetch("/api/habits/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, habitId, date }),
      });
    } else {
      toggleSoloCheckin(habitId, date);
    }
    await load();
  }

  async function addPreset(presetId: string) {
    setAdding(true);
    if (token) {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, presetId }),
      });
    } else {
      addSoloPreset(presetId);
    }
    setAdding(false);
    await load();
  }

  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customLabel.trim()) return;
    setAdding(true);
    if (token) {
      const match = HABIT_PRESETS.find(
        (p) => p.label.toLowerCase() === customLabel.trim().toLowerCase()
      );
      if (match) {
        await fetch("/api/habits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, presetId: match.id }),
        });
      } else {
        // Guild API is preset-only; custom activities stay on-device.
        addSoloCustom({ label: customLabel, emoji: customEmoji, goal: customGoal });
      }
    } else {
      addSoloCustom({ label: customLabel, emoji: customEmoji, goal: customGoal });
    }
    setCustomLabel("");
    setAdding(false);
    await load();
  }

  function removeHabit(habitId: string) {
    if (!listSoloHabits().some((h) => h.id === habitId)) return;
    removeSoloHabit(habitId);
    load();
  }

  if (loading) return <PremiumLoader full className="min-h-[12vh]" size="sm" />;
  if (!data) return <p className="text-red-400">Could not load habits</p>;

  const daysInMonth = getMonthDays(year, month);
  const monthLabel = new Date(year, month - 1).toLocaleString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const today = new Date().toISOString().slice(0, 10);
  const myPresetIds = (() => {
    const ids = solo ? soloPresetIdsInUse() : new Set<string>();
    if (!solo) {
      for (const h of data.grid) {
        const match = HABIT_PRESETS.find((p) => p.label === h.label);
        if (match) ids.add(match.id);
      }
      for (const id of soloPresetIdsInUse()) ids.add(id);
    }
    return ids;
  })();
  const canRemove = (habitId: string) => listSoloHabits().some((h) => h.id === habitId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Habit tracker</h2>
          <p className="text-xs text-white/65">
            Grille mensuelle · objectif vs réalisé
            {fellowshipCode
              ? ` · potes voient tout sur /f/${fellowshipCode}`
              : " · solo (guild optional) — stays on this device"}
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
            }}
          >
            →
          </button>
        </div>
      </div>

      {data.grid.length === 0 ? (
        <p className="text-stone-500">Aucune habitude. Ajoute-en ci-dessous.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#3a3d40] bg-[#1a1c1e]/60">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-stone-500">
                <th className="sticky left-0 bg-[#242628] py-2 pr-3 pl-3 text-left font-normal">
                  Habitude
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th key={i} className="w-6 px-0.5 py-2 font-normal">
                    {i + 1}
                  </th>
                ))}
                <th className="px-2 py-2 font-normal">Goal</th>
                <th className="px-2 py-2 font-normal">Done</th>
                <th className="px-2 py-2 font-normal">%</th>
                <th className="px-2 py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {data.grid.map((habit) => {
                const badge = verificationBadge(
                  habit.verification as "manual" | "auto_focus" | "auto_clean"
                );
                return (
                  <tr key={habit.id} className="border-b border-white/5">
                    <td className="sticky left-0 bg-[#242628] py-2 pr-3 pl-3">
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
                    <td className="px-2 text-center">
                      {canRemove(habit.id) ? (
                        <button
                          type="button"
                          onClick={() => removeHabit(habit.id)}
                          className="text-[#9ca3af] hover:text-red-400"
                          title="Remove"
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-600">
          Ajouter depuis PERSO.xlsx
        </p>
        <div className="flex flex-wrap gap-2">
          {HABIT_PRESETS.filter((p) => !myPresetIds.has(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={adding}
              onClick={() => addPreset(p.id)}
              className="rounded-full border border-[#3a3d40] bg-[#2e3134]/50 px-3 py-1.5 text-xs text-[#9ca3af] hover:border-[#b8422e] hover:text-[#f4f4f5]"
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={addCustom} className="mt-5 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-600">
            Emoji
          </label>
          <input
            value={customEmoji}
            onChange={(e) => setCustomEmoji(e.target.value.slice(0, 4))}
            className="input-premium w-14 py-2 text-center text-sm"
            maxLength={4}
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-600">
            Your activity
          </label>
          <input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="e.g. Deep work AM, Gym, Journal…"
            className="input-premium w-full py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-600">
            Goal / mo
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={customGoal}
            onChange={(e) => setCustomGoal(Number(e.target.value) || 20)}
            className="input-premium w-16 py-2 text-center text-sm"
          />
        </div>
        <button type="submit" disabled={adding || !customLabel.trim()} className="btn-primary py-2 text-sm">
          Add
        </button>
      </form>
    </div>
  );
}
