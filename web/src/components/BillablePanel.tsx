"use client";

import { useCallback, useEffect, useState } from "react";

type Client = {
  id: string;
  name: string;
  hourly_rate_cents: number;
  currency: string;
};

type Summary = {
  rows: Array<{
    client_id: string;
    name: string;
    hours: number;
    billable_cents: number;
    currency: string;
  }>;
  total_cents: number;
  from: string;
  to: string;
};

export function BillablePanel({ token }: { token: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("80");

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      fetch(`/api/clients?token=${encodeURIComponent(token)}`),
      fetch(`/api/billable?token=${encodeURIComponent(token)}`),
    ]);
    if (c.ok) {
      const j = (await c.json()) as { clients: Client[] };
      setClients(j.clients);
    }
    if (s.ok) setSummary((await s.json()) as Summary);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: name.trim(),
        hourly_rate_cents: Math.round(Number(rate) * 100) || 0,
      }),
    });
    setName("");
    load();
  };

  const exportCsv = () => {
    window.open(`/api/billable?token=${encodeURIComponent(token)}&format=csv`, "_blank");
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[#c4653a]">Billable</p>
        <button
          type="button"
          onClick={exportCsv}
          className="text-xs text-white/50 hover:text-white"
        >
          Export CSV
        </button>
      </div>
      {summary && (
        <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
          {(summary.total_cents / 100).toFixed(0)} €
          <span className="ml-2 text-sm font-normal text-white/40">this period</span>
        </p>
      )}
      <ul className="mt-3 space-y-1 text-sm text-white/60">
        {(summary?.rows || []).map((r) => (
          <li key={r.client_id} className="flex justify-between">
            <span>{r.name}</span>
            <span>
              {r.hours}h · {(r.billable_cents / 100).toFixed(0)} €
            </span>
          </li>
        ))}
        {clients.length === 0 && <li className="text-white/40">Add a client to start tracking.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client name"
          className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
        />
        <input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="€/h"
          className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
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
