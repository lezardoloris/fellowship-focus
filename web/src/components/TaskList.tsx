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
    <div className="premium-panel p-5">
      <div className="flex items-center justify-between">
        <p className="pp-title">Tasks</p>
        <span className="text-xs pp-faint">{openEstimate} min planned</span>
      </div>
      <ul className="mt-3.5 max-h-56 space-y-1.5 overflow-y-auto text-sm">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2.5 pp-body">
            <button
              type="button"
              onClick={() => toggle(t)}
              className={`h-4 w-4 flex-none rounded border ${
                t.completed ? "border-emerald-400 bg-emerald-400/30" : "border-white/35"
              }`}
              aria-label="Toggle"
            />
            <span className={`flex-1 ${t.completed ? "line-through opacity-45" : ""}`}>
              {t.title}
            </span>
            {t.estimate_minutes > 0 && (
              <span className="text-xs pp-faint">{t.estimate_minutes}m</span>
            )}
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="text-xs pp-faint hover:pp-strong"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3.5 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New task"
          className="pp-input flex-1 px-3 py-2 text-sm"
        />
        <input
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          className="pp-input w-16 px-2 py-2 text-sm text-center tabular-nums"
          title="Estimate minutes"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-[#b8422e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c9563d]"
        >
          Add
        </button>
      </div>
    </div>
  );
}
