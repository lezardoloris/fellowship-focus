"use client";

import { useCallback, useEffect, useState } from "react";

type StakeEntry = {
  id: string;
  member_id: string;
  email: string | null;
  funded: number;
  outcome: string;
};

type Stake = {
  id: string;
  title: string;
  amount_cents: number;
  min_habit_rate: number;
  max_blocks: number;
  status: string;
  entries: StakeEntry[];
};

export function StakesPanel({
  token,
  fellowshipCode,
  memberNames,
}: {
  token: string;
  fellowshipCode: string;
  memberNames: Record<string, string>;
}) {
  const [stake, setStake] = useState<Stake | null>(null);
  const [escrowOk, setEscrowOk] = useState(false);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState(10);
  const [escrowUrl, setEscrowUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/stakes?fellowship=${fellowshipCode}`);
    if (res.ok) {
      const json = await res.json();
      setStake(json.stake);
      setEscrowOk(json.escrowConfigured);
    }
  }, [fellowshipCode]);

  useEffect(() => {
    load();
  }, [load]);

  async function createStake() {
    setCreating(true);
    const res = await fetch("/api/stakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        action: "create",
        title: `Ring deposit — €${amount}`,
        amountCents: amount * 100,
        minHabitRate: 70,
        maxBlocks: 5,
      }),
    });
    if (res.ok) await load();
    setCreating(false);
  }

  async function fundStake() {
    if (!stake || !email.trim()) return;
    const res = await fetch("/api/stakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "fund", stakeId: stake.id, email: email.trim() }),
    });
    const json = await res.json();
    if (json.escrowUrl) setEscrowUrl(json.escrowUrl);
    await load();
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">Weekly stakes</h2>
      <p className="mb-4 text-xs text-white/55">
        Put money on the line via Escrow.com — auto checks (focus, blocks) plus manual habit review.
      </p>

      {!stake ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-white/60">Stake per person</label>
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
          <button type="button" onClick={createStake} disabled={creating} className="btn-primary">
            {creating ? "…" : "Open this week’s stake"}
          </button>
          <p className="text-xs text-white/45">
            Rules: ≥70% habits (auto = full weight, manual = 80%) and at most 5 block hits. Winners split the pot on Sunday.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#3a3d40] bg-[#2e3134] p-4">
            <p className="font-semibold text-[#f4f4f5]">{stake.title}</p>
            <p className="mt-1 text-xs text-white/50">
              €{(stake.amount_cents / 100).toFixed(0)}/person · ≥{stake.min_habit_rate}% habits · max{" "}
              {stake.max_blocks} blocks
            </p>
            <p className="mt-1 text-xs text-white/40">Status: {stake.status}</p>
          </div>

          <ul className="space-y-2 text-sm">
            {stake.entries.map((e) => (
              <li key={e.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
                <span>{memberNames[e.member_id] ?? "Member"}</span>
                <span className={e.funded ? "text-green-400" : "text-white/45"}>
                  {e.funded ? "✓ Funded" : "Pending"}
                  {e.outcome !== "pending" && ` · ${e.outcome}`}
                </span>
              </li>
            ))}
          </ul>

          {escrowOk ? (
            <div className="space-y-2">
              <input
                type="email"
                placeholder="you@email.com (Escrow)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-premium w-full"
              />
              <button type="button" onClick={fundStake} className="btn-primary w-full">
                Deposit via Escrow
              </button>
              {escrowUrl && (
                <a href={escrowUrl} target="_blank" rel="noopener noreferrer" className="text-xs accent-text underline">
                  Open Escrow transaction →
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/45">
              Escrow is not configured on this server. Ask the host to set ESCROW_API_KEY and ESCROW_EMAIL.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
