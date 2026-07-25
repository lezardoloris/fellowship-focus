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
    <div className="premium-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="pp-title">Billable</p>
        <button
          type="button"
          onClick={exportCsv}
          className="text-xs pp-muted transition-colors hover:pp-strong"
        >
          Export CSV
        </button>
      </div>
      {summary && (
        <p className="mt-2.5 text-3xl font-bold tabular-nums pp-strong">
          {(summary.total_cents / 100).toFixed(0)} €
          <span className="ml-2 text-sm font-normal pp-muted">this period</span>
        </p>
      )}
      <ul className="mt-3.5 space-y-1.5 text-sm pp-body">
        {(summary?.rows || []).map((r) => (
          <li key={r.client_id} className="flex justify-between">
            <span>{r.name}</span>
            <span className="tabular-nums pp-muted">
              {r.hours}h · {(r.billable_cents / 100).toFixed(0)} €
            </span>
          </li>
        ))}
        {clients.length === 0 && <li className="pp-faint">Add a client to start tracking.</li>}
      </ul>
      <div className="mt-3.5 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client name"
          className="pp-input min-w-[140px] flex-1 px-3 py-2 text-sm"
        />
        <input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="€/h"
          className="pp-input w-20 px-2 py-2 text-sm text-center tabular-nums"
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
