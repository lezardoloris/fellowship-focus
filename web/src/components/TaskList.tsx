"use client";

import { useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  completed: number;
  estimate_minutes: number;
  time_spent_seconds: number;
};

export function TaskList({ token }: { token: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState("25");

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks?token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const j = (await res.json()) as { tasks: Task[] };
      setTasks(j.tasks);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!title.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        title: title.trim(),
        estimate_minutes: Number(estimate) || 0,
      }),
    });
    setTitle("");
    load();
  };

  const toggle = async (t: Task) => {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, completed: !t.completed }),
    });
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/tasks/${id}?token=${encodeURIComponent(token)}`, { method: "DELETE" });
    load();
  };

  const openEstimate = tasks
    .filter((t) => !t.completed)
    .reduce((a, t) => a + (t.estimate_minutes || 0), 0);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[#c4653a]">Tasks</p>
        <span className="text-xs text-white/40">{openEstimate} min planned</span>
      </div>
      <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-white/70">
            <button
              type="button"
              onClick={() => toggle(t)}
              className={`h-4 w-4 rounded border ${
                t.completed ? "border-emerald-400 bg-emerald-400/30" : "border-white/25"
              }`}
              aria-label="Toggle"
            />
            <span className={`flex-1 ${t.completed ? "line-through opacity-40" : ""}`}>
              {t.title}
            </span>
            {t.estimate_minutes > 0 && (
              <span className="text-xs text-white/35">{t.estimate_minutes}m</span>
            )}
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="text-xs text-white/30 hover:text-white/70"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New task"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
        />
        <input
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          className="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          title="Estimate minutes"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-[#b8422e] px-3 py-1.5 text-sm font-semibold text-white"
        >
          Add
        </button>
      </div>
    </div>
  );
}
