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

type ProfitRow = {
  project_id: string;
  name: string;
  client: string | null;
  currency: string;
  estimate_minutes: number;
  actual_minutes: number;
  over_minutes: number;
  over_budget: boolean;
  actual_cents: number;
  effective_rate_cents: number;
};

type Rule = { id: string; client_id: string; match_type: string; pattern: string };

type Tab = "summary" | "profit" | "rules";

const eur = (cents: number, cur = "EUR") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
    cents / 100
  );

export function BillablePanel({ token }: { token: string }) {
  const [tab, setTab] = useState<Tab>("summary");
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [profit, setProfit] = useState<ProfitRow[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("80");

  const q = `token=${encodeURIComponent(token)}`;

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      fetch(`/api/clients?${q}`),
      fetch(`/api/billable?${q}`),
    ]);
    if (c.ok) setClients(((await c.json()) as { clients: Client[] }).clients);
    if (s.ok) setSummary((await s.json()) as Summary);
  }, [q]);

  const loadProfit = useCallback(async () => {
    const r = await fetch(`/api/projects?${q}&view=profitability`);
    if (r.ok) setProfit(((await r.json()) as { rows: ProfitRow[] }).rows);
  }, [q]);

  const loadRules = useCallback(async () => {
    const r = await fetch(`/api/client-rules?${q}`);
    if (r.ok) setRules(((await r.json()) as { rules: Rule[] }).rules);
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (tab === "profit") loadProfit();
    if (tab === "rules") loadRules();
  }, [tab, loadProfit, loadRules]);

  const addClient = async () => {
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

  const openInvoice = () =>
    window.open(`/api/billable?${q}&format=invoice`, "_blank");
  const exportCsv = () => window.open(`/api/billable?${q}&format=csv`, "_blank");

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name || id;

  return (
    // [UX-E3.3] Fixed floor so switching tabs (summary ~260px vs profit/rules)
    // never resizes the panel and shoves its grid neighbour around.
    <div className="premium-panel p-5" style={{ minHeight: 300 }}>
      <div className="flex items-center justify-between gap-2">
        <p className="pp-title">Billable</p>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={exportCsv} className="pp-muted transition-colors hover:text-white">
            CSV
          </button>
          <button type="button" onClick={openInvoice} className="pp-muted transition-colors hover:text-white">
            Invoice PDF
          </button>
        </div>
      </div>

      {/* Where the money comes from — tabs */}
      <div className="mt-3 flex gap-1 text-xs">
        {(
          [
            ["summary", "By client"],
            ["profit", "Profitability"],
            ["rules", "Auto-attribution"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              tab === id ? "bg-[#b8422e] text-white" : "pp-muted hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <>
          {summary && (
            <p className="mt-3 text-3xl font-bold tabular-nums pp-strong">
              {eur(summary.total_cents)}
              <span className="ml-2 text-sm font-normal pp-muted">this period</span>
            </p>
          )}
          <ul className="mt-3 space-y-1.5 text-sm pp-body">
            {(summary?.rows || []).map((r) => (
              <li key={r.client_id} className="flex justify-between">
                <span>{r.name}</span>
                <span className="tabular-nums pp-muted">
                  {r.hours}h · {eur(r.billable_cents, r.currency)}
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
              onClick={addClient}
              className="rounded-lg bg-[#b8422e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c9563d]"
            >
              Add
            </button>
          </div>
        </>
      )}

      {tab === "profit" && (
        <div className="mt-3">
          <p className="text-xs pp-faint">Estimate vs actual — flags projects eating your margin.</p>
          <ul className="mt-2.5 space-y-2 text-sm">
            {profit.length === 0 && (
              <li className="pp-faint">Add projects with a time estimate to see profitability.</li>
            )}
            {profit.map((p) => {
              const estH = (p.estimate_minutes / 60).toFixed(1);
              const actH = (p.actual_minutes / 60).toFixed(1);
              return (
                <li key={p.project_id} className="border-b border-white/5 pb-2">
                  <div className="flex justify-between">
                    <span className="pp-body">
                      {p.name}
                      {p.client && <span className="pp-faint"> · {p.client}</span>}
                    </span>
                    <span className="tabular-nums pp-muted">{eur(p.actual_cents, p.currency)}</span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-xs">
                    <span className={p.over_budget ? "text-[#e0674a]" : "pp-faint"}>
                      {p.estimate_minutes > 0
                        ? `${actH}h / ${estH}h est${p.over_budget ? ` · +${(p.over_minutes / 60).toFixed(1)}h over` : ""}`
                        : `${actH}h · no estimate`}
                    </span>
                    {p.over_budget && (
                      <span className="text-[#e0674a]">
                        eff. {eur(p.effective_rate_cents, p.currency)}/h
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "rules" && (
        <RulesEditor
          token={token}
          rules={rules}
          clients={clients}
          clientName={clientName}
          onChange={loadRules}
        />
      )}
    </div>
  );
}

function RulesEditor({
  token,
  rules,
  clients,
  clientName,
  onChange,
}: {
  token: string;
  rules: Rule[];
  clients: Client[];
  clientName: (id: string) => string;
  onChange: () => void;
}) {
  const [pattern, setPattern] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    if (!clientId && clients[0]) setClientId(clients[0].id);
  }, [clients, clientId]);

  const add = async () => {
    if (!pattern.trim() || !clientId) return;
    await fetch("/api/client-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, client_id: clientId, pattern: pattern.trim() }),
    });
    setPattern("");
    onChange();
  };
  const remove = async (id: string) => {
    await fetch(`/api/client-rules?token=${encodeURIComponent(token)}&id=${id}`, {
      method: "DELETE",
    });
    onChange();
  };

  return (
    <div className="mt-3">
      <p className="text-xs pp-faint">
        When an app or site matches, the client is pre-filled — never committed without your confirm.
      </p>
      <ul className="mt-2.5 space-y-1.5 text-sm pp-body">
        {rules.length === 0 && <li className="pp-faint">No rules yet. Add one below.</li>}
        {rules.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2">
            <span className="truncate">
              <span className="pp-muted">“{r.pattern}”</span> → {clientName(r.client_id)}
            </span>
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="flex-none text-xs pp-faint hover:text-[#e0674a]"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {clients.length === 0 ? (
        <p className="mt-3 pp-faint text-sm">Add a client first (By client tab).</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. figma"
            className="pp-input min-w-[120px] flex-1 px-3 py-2 text-sm"
          />
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="pp-input px-2 py-2 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            className="rounded-lg bg-[#b8422e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c9563d]"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
