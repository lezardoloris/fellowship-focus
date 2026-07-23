"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_HABIT_MARK,
  HABIT_PRESETS,
  PREMIUM_HABIT_MARKS,
  getMonthDays,
  verificationBadge,
} from "@/lib/habits";
import { applyHabitOrder, moveInOrder, saveHabitOrder } from "@/lib/habitOrder";
import {
  addSoloCustom,
  addSoloPreset,
  getSoloHabitGrid,
  listSoloHabits,
  removeSoloHabit,
  reorderSoloHabits,
  soloPresetIdsInUse,
  toggleSoloCheckin,
} from "@/lib/soloHabits";
import { HabitMark } from "@/components/HabitMark";
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

export function HabitTracker({ token }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<HabitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customEmoji, setCustomEmoji] = useState<string>(DEFAULT_HABIT_MARK);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [customGoal, setCustomGoal] = useState(20);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const dragRef = useRef<{ id: string; fromIndex: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const solo = !token;

  useEffect(() => {
    if (!emojiOpen) return;
    function onDoc(e: MouseEvent) {
      if (!emojiWrapRef.current?.contains(e.target as Node)) setEmojiOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

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
        const merged = [
          ...api.grid,
          ...soloRows.filter((h) => !apiLabels.has(h.label.toLowerCase())),
        ];
        setData({
          ...api,
          grid: applyHabitOrder(merged, token),
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
    setCustomEmoji(DEFAULT_HABIT_MARK);
    setEmojiOpen(false);
    setAdding(false);
    await load();
  }

  function removeHabit(habitId: string) {
    if (!listSoloHabits().some((h) => h.id === habitId)) return;
    removeSoloHabit(habitId);
    load();
  }

  const persistHabitOrder = useCallback(
    (orderedIds: string[]) => {
      const soloIds = new Set(listSoloHabits().map((h) => h.id));
      if (solo) {
        reorderSoloHabits(orderedIds);
      } else if (token) {
        saveHabitOrder(token, orderedIds);
        reorderSoloHabits(orderedIds.filter((id) => soloIds.has(id)));
      }
      setData((prev) => {
        if (!prev) return prev;
        const byId = new Map(prev.grid.map((h) => [h.id, h]));
        const grid = orderedIds
          .map((id) => byId.get(id))
          .filter((h): h is HabitRow => Boolean(h));
        for (const h of prev.grid) {
          if (!orderedIds.includes(h.id)) grid.push(h);
        }
        return { ...prev, grid };
      });
    },
    [solo, token]
  );

  function resolveDropIndex(clientY: number): number {
    const rows = tbodyRef.current?.querySelectorAll<HTMLTableRowElement>("[data-habit-row]");
    if (!rows?.length) return 0;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) return i;
    }
    return rows.length;
  }

  function finishDrag(toIndex: number) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    setDropIndex(null);
    if (!drag || !data) return;
    if (drag.fromIndex === toIndex || drag.fromIndex + 1 === toIndex) return;

    const ids = data.grid.map((h) => h.id);
    persistHabitOrder(moveInOrder(ids, drag.fromIndex, toIndex));
  }

  function onDragHandlePointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    habitId: string,
    index: number
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: habitId, fromIndex: index };
    setDraggingId(habitId);
    setDropIndex(index);
  }

  function onDragHandlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    setDropIndex(resolveDropIndex(e.clientY));
  }

  function onDragHandlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    finishDrag(resolveDropIndex(e.clientY));
  }

  function onDragHandlePointerCancel() {
    dragRef.current = null;
    setDraggingId(null);
    setDropIndex(null);
  }

  function onDragHandleKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (!data) return;
    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      const ids = data.grid.map((h) => h.id);
      persistHabitOrder(moveInOrder(ids, index, index - 1));
    } else if (e.key === "ArrowDown" && index < data.grid.length - 1) {
      e.preventDefault();
      const ids = data.grid.map((h) => h.id);
      persistHabitOrder(moveInOrder(ids, index, index + 2));
    }
  }

  if (loading) return <PremiumLoader full className="min-h-[12vh]" size="sm" />;
  if (!data) return <p className="text-red-400">Could not load habits</p>;

  const daysInMonth = getMonthDays(year, month);
  const monthLabel = new Date(year, month - 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const nowLocal = new Date();
  const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
  const isViewingCurrentMonth =
    year === nowLocal.getFullYear() && month === nowLocal.getMonth() + 1;
  const todayDay = isViewingCurrentMonth ? nowLocal.getDate() : null;
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
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous month"
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
            aria-label="Next month"
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
        <div className="rounded-xl border border-[#b8422e]/35 bg-[#b8422e]/10 px-4 py-3 text-sm text-white/80">
          No habits yet. Add a preset below or create your own activity.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#3a3d40] bg-[#1a1c1e]/60">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-stone-500">
                <th className="sticky left-0 bg-[#242628] py-2 pr-3 pl-3 text-left font-normal">
                  Habit
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const dayNum = i + 1;
                  const isTodayCol = todayDay === dayNum;
                  return (
                    <th
                      key={i}
                      aria-current={isTodayCol ? "date" : undefined}
                      className={`w-6 px-0.5 py-2 font-normal ${
                        isTodayCol
                          ? "habit-col-today habit-col-today-header"
                          : isViewingCurrentMonth
                            ? "text-stone-600/70"
                            : ""
                      }`}
                    >
                      {isTodayCol ? (
                        <span className="habit-today-head">
                          <span className="habit-today-num">{dayNum}</span>
                          <span className="habit-today-label">Today</span>
                        </span>
                      ) : (
                        dayNum
                      )}
                    </th>
                  );
                })}
                <th className="px-2 py-2 font-normal">Goal</th>
                <th className="px-2 py-2 font-normal">Done</th>
                <th className="px-2 py-2 font-normal">%</th>
                <th className="px-2 py-2 font-normal" />
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {data.grid.map((habit, rowIndex) => {
                const badge = verificationBadge(
                  habit.verification as "manual" | "auto_focus" | "auto_clean" | "auto_github"
                );
                const isDragging = draggingId === habit.id;
                const showDropBefore =
                  dropIndex === rowIndex && draggingId !== null && !isDragging;
                const showDropAfter =
                  dropIndex === data.grid.length &&
                  rowIndex === data.grid.length - 1 &&
                  draggingId !== null &&
                  !isDragging;
                return (
                  <tr
                    key={habit.id}
                    data-habit-row
                    className={`border-b border-white/5 transition-opacity ${
                      isDragging ? "habit-row-dragging opacity-40" : ""
                    } ${showDropBefore ? "habit-row-drop-before" : ""} ${
                      showDropAfter ? "habit-row-drop-after" : ""
                    }`}
                  >
                    <td className="sticky left-0 bg-[#242628] py-2 pr-3 pl-2">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          aria-label={`Reorder ${habit.label}`}
                          className="habit-drag-handle mt-0.5 shrink-0 touch-none"
                          onPointerDown={(e) => onDragHandlePointerDown(e, habit.id, rowIndex)}
                          onPointerMove={onDragHandlePointerMove}
                          onPointerUp={onDragHandlePointerUp}
                          onPointerCancel={onDragHandlePointerCancel}
                          onKeyDown={(e) => onDragHandleKeyDown(e, rowIndex)}
                        >
                          <svg
                            width="10"
                            height="14"
                            viewBox="0 0 10 14"
                            fill="currentColor"
                            aria-hidden
                          >
                            <circle cx="2.5" cy="2.5" r="1.2" />
                            <circle cx="7.5" cy="2.5" r="1.2" />
                            <circle cx="2.5" cy="7" r="1.2" />
                            <circle cx="7.5" cy="7" r="1.2" />
                            <circle cx="2.5" cy="11.5" r="1.2" />
                            <circle cx="7.5" cy="11.5" r="1.2" />
                          </svg>
                        </button>
                        <span className="min-w-0">
                          <HabitMark mark={habit.emoji} className="mr-1.5 text-[1.05rem]" />
                          <span className="text-stone-300">{habit.label}</span>
                          <span className={`ml-1 ${badge.color}`}>({badge.label})</span>
                        </span>
                      </div>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const dayNum = i + 1;
                      const d = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                      const cell = habit.checkins[d];
                      const done = cell?.completed;
                      const isFuture = d > today;
                      const isManual = habit.verification === "manual";
                      const isTodayCol = todayDay === dayNum;
                      return (
                        <td
                          key={d}
                          className={`px-0.5 py-1 text-center ${isTodayCol ? "habit-col-today" : ""}`}
                        >
                          <button
                            type="button"
                            disabled={isFuture || !isManual}
                            onClick={() => toggleDay(habit.id, d, habit.verification)}
                            aria-label={`${habit.label} · day ${dayNum}${isTodayCol ? " · today" : ""}${done ? " · done" : ""}`}
                            className={`${isTodayCol ? "habit-day-btn-today" : "h-5 w-5 rounded"} ${
                              done
                                ? "bg-[#b8422e] text-white"
                                : isFuture
                                  ? "bg-white/5"
                                  : isManual
                                    ? isTodayCol
                                      ? "bg-[#b8422e]/18 hover:bg-[#b8422e]/28"
                                      : "bg-white/10 hover:bg-white/20"
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">
          Quick add
        </p>
        <div className="flex flex-wrap gap-2">
          {HABIT_PRESETS.filter((p) => !myPresetIds.has(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={adding}
              onClick={() => addPreset(p.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3a3d40] bg-[#2e3134]/50 px-3 py-1.5 text-xs text-[#9ca3af] hover:border-[#b8422e] hover:text-[#f4f4f5]"
            >
              <HabitMark mark={p.emoji} className="text-[0.95rem]" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={addCustom} className="mt-5 flex flex-wrap items-end gap-2">
        <div ref={emojiWrapRef} className="relative">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-stone-600">
            Mark
          </label>
          <button
            type="button"
            aria-expanded={emojiOpen}
            aria-haspopup="listbox"
            onClick={() => setEmojiOpen((o) => !o)}
            className="flex h-[42px] w-14 items-center justify-center rounded-md border border-[#b8422e]/55 bg-gradient-to-b from-[#3a221c] to-[#1a1210] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-[#b8422e] hover:from-[#4a2a22]"
            title="Choose a mark"
          >
            <HabitMark mark={customEmoji} className="text-[1.35rem]" />
          </button>
          {emojiOpen ? (
            <div
              role="listbox"
              aria-label="Premium habit marks"
              className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-[232px] rounded-xl border border-white/12 bg-[#121416]/98 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
            >
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Premium marks
              </p>
              <div className="grid grid-cols-6 gap-1">
                {PREMIUM_HABIT_MARKS.map((id) => {
                  const selected = id === customEmoji;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setCustomEmoji(id);
                        setEmojiOpen(false);
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                        selected
                          ? "bg-[#b8422e]/35 ring-1 ring-[#b8422e]"
                          : "hover:bg-white/8"
                      }`}
                    >
                      <HabitMark mark={id} className="text-[1.05rem]" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
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
