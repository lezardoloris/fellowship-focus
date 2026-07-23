"use client";

import { useCallback, useEffect, useState } from "react";

type StakeEntry = {
  id: string;
  member_id: string;
  email: string | null;
  funded: number;
  outcome: string;
  escrow_transaction_id: string | null;
  settlement_status: string | null;
};

type Stake = {
  id: string;
  title: string;
  amount_cents: number;
  min_habit_rate: number;
  max_blocks: number;
  goal_label: string;
  goal_type: string;
  status: string;
  settlement_note: string | null;
  week_start: string;
  entries: StakeEntry[];
};

const GOALS = [
  { id: "habits", label: "Habits ≥70% + max 5 blocks" },
  { id: "clean", label: "Clean week — max 2 blocks" },
  { id: "grind", label: "Grind — habits ≥85%" },
  { id: "github", label: "Ship code — GitHub commits this week" },
  { id: "custom", label: "Custom goal text" },
];

export function StakesPanel({
  token,
  fellowshipCode,
  memberNames,
  onSettled,
}: {
  token: string;
  fellowshipCode: string;
  memberNames: Record<string, string>;
  onSettled?: (note: string) => void;
}) {
  const [stake, setStake] = useState<Stake | null>(null);
  const [escrowOk, setEscrowOk] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [settling, setSettling] = useState(false);
  const [amount, setAmount] = useState(10);
  const [goalType, setGoalType] = useState("habits");
  const [customGoal, setCustomGoal] = useState("");
  const [escrowUrl, setEscrowUrl] = useState<string | null>(null);
  const [agreeUrl, setAgreeUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ceremony, setCeremony] = useState<{
    note: string;
    winners: string[];
    losers: string[];
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/stakes?fellowship=${fellowshipCode}`);
    if (res.ok) {
      const json = await res.json();
      setStake(json.stake);
      setEscrowOk(json.escrowConfigured);
      setSandbox(Boolean(json.sandbox));
    }
  }, [fellowshipCode]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function createStake() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/stakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        action: "create",
        title: `Ring Deposit — €${amount}`,
        amountCents: amount * 100,
        goalType,
        goalLabel: goalType === "custom" ? customGoal.trim() || "Custom goal" : undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error || "Could not create stake");
    else await load();
    setCreating(false);
  }

  async function fundStake() {
    if (!stake || !email.trim()) return;
    setError(null);
    setMsg(null);
    const res = await fetch("/api/stakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "fund", stakeId: stake.id, email: email.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Deposit failed");
      return;
    }
    if (json.escrowUrl) setEscrowUrl(json.escrowUrl);
    if (json.agreeUrl) setAgreeUrl(json.agreeUrl);
    setMsg(json.message || "Agree & pay on Escrow. Funded after payment secures.");
    await load();
  }

  async function settle() {
    if (!confirm("Settle this week’s goal bet? Winners refund · losers feed the pot.")) return;
    setSettling(true);
    setError(null);
    const res = await fetch("/api/stakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "settle" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Settle failed");
    } else {
      const note = json.stake?.settlement_note || "Settled";
      setMsg(note);
      const entries = (json.stake?.entries || []) as StakeEntry[];
      setCeremony({
        note,
        winners: entries
          .filter((e) => e.outcome === "winner")
          .map((e) => memberNames[e.member_id] || "Member"),
        losers: entries
          .filter((e) => e.outcome === "forfeited" || e.outcome === "partial")
          .map((e) => memberNames[e.member_id] || "Member"),
      });
      onSettled?.(note);
    }
    await load();
    setSettling(false);
  }

  const active = stake && (stake.status === "open" || stake.status === "active");
  const fundedCount = stake?.entries.filter((e) => e.funded).length ?? 0;
  const pendingPay = stake?.entries.filter((e) => e.escrow_transaction_id && !e.funded).length ?? 0;

  return (
    <div>
      {ceremony && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          onClick={() => setCeremony(null)}
        >
          <div
            className="guild-levelup glass-panel max-w-sm px-7 py-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
              Ring settled
            </p>
            <p className="font-display mt-3 text-2xl text-white">Pot closed</p>
            <p className="mt-2 text-xs text-white/60">{ceremony.note}</p>
            {ceremony.winners.length > 0 && (
              <p className="mt-4 text-sm text-green-400/90">
                Winners · {ceremony.winners.join(", ")}
              </p>
            )}
            {ceremony.losers.length > 0 && (
              <p className="mt-1 text-sm text-white/45">Pot · {ceremony.losers.join(", ")}</p>
            )}
            <button type="button" className="btn-primary mt-6 w-full" onClick={() => setCeremony(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Goal bets</h3>
        {sandbox && (
          <span className="text-[10px] uppercase tracking-wide text-amber-400/80">Escrow sandbox</span>
        )}
      </div>
      <p className="mb-4 text-[11px] text-white/45">
        Real money via Escrow · winners reclaim stake + split the pot
      </p>

      {!active && (!stake || stake.status.startsWith("settled")) ? (
        <div className="space-y-3">
          {stake?.status.startsWith("settled") && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              Last · {stake.settlement_note || stake.title}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-white/60">Stake</label>
            <select
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input-premium w-24"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  €{n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/60">Goal</label>
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value)}
              className="input-premium w-full"
            >
              {GOALS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          {goalType === "custom" && (
            <input
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder="e.g. No Twitter before noon"
              className="input-premium w-full"
            />
          )}
          <button type="button" onClick={createStake} disabled={creating} className="btn-primary">
            {creating ? "…" : "Open Ring Deposit"}
          </button>
        </div>
      ) : stake ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#b8422e]/25 bg-[#b8422e]/10 p-4">
            <p className="font-display text-lg text-white">
              €{(stake.amount_cents / 100).toFixed(0)}
              <span className="ml-1 text-sm font-sans font-normal text-white/50">/ person</span>
            </p>
            <p className="mt-1 text-sm text-white/75">{stake.goal_label}</p>
            <p className="mt-2 text-[11px] text-white/45">
              {stake.title} · week of {stake.week_start} · {stake.status}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-green-400/90">
                {fundedCount} secured
              </span>
              {pendingPay > 0 && (
                <span className="rounded-full border border-amber-400/30 px-2 py-0.5 text-amber-300/80">
                  {pendingPay} awaiting pay
                </span>
              )}
            </div>
          </div>

          <ul className="space-y-2 text-sm">
            {stake.entries.map((e) => (
              <li key={e.id} className="flex justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                <span className="text-white/85">{memberNames[e.member_id] ?? "Member"}</span>
                <span className={e.funded ? "text-green-400" : "text-white/40"}>
                  {e.funded ? "✓ Funded" : e.escrow_transaction_id ? "Awaiting pay" : "Pending"}
                  {e.outcome !== "pending" && ` · ${e.outcome}`}
                </span>
              </li>
            ))}
          </ul>

          {active && escrowOk && (
            <div className="space-y-2">
              <input
                type="email"
                placeholder="Escrow email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-premium w-full"
              />
              <button type="button" onClick={fundStake} className="btn-primary w-full">
                Deposit via Escrow
              </button>
              {(agreeUrl || escrowUrl) && (
                <div className="flex flex-col gap-1 text-xs">
                  {agreeUrl && (
                    <a href={agreeUrl} target="_blank" rel="noopener noreferrer" className="accent-text underline">
                      1. Agree →
                    </a>
                  )}
                  {escrowUrl && (
                    <a href={escrowUrl} target="_blank" rel="noopener noreferrer" className="accent-text underline">
                      2. Pay on Escrow →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {active && !escrowOk && (
            <p className="text-xs text-white/45">Set ESCROW_EMAIL + ESCROW_API_KEY on the server.</p>
          )}

          {active && (
            <button
              type="button"
              onClick={settle}
              disabled={settling}
              className="w-full rounded-lg border border-white/15 px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/5 disabled:opacity-40"
            >
              {settling ? "Settling…" : "Settle week — ceremony"}
            </button>
          )}
        </div>
      ) : null}

      {msg && <p className="mt-3 text-xs text-emerald-400/90">{msg}</p>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
