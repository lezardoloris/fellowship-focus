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
        title: `Ring Deposit — ${amount}€`,
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
      <h2 className="font-display mb-1 text-xl font-semibold">Weekly stakes</h2>
      <p className="mb-4 text-xs text-stone-500">
        Mise en jeu via Escrow.com — vérification auto (focus, blocks) + manuel (habitudes PERSO)
      </p>

      {!stake ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-stone-400">Mise / personne</label>
            <select
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input-premium w-24"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}€
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={createStake} disabled={creating} className="btn-primary">
            {creating ? "…" : "Ouvrir le pari de la semaine"}
          </button>
          <p className="text-xs text-stone-600">
            Règles : ≥70% habits (auto = 100%, manuel = 80% poids) + max 5 block pages. Gagnants split le pot dimanche.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
            <p className="font-semibold text-amber-200">{stake.title}</p>
            <p className="mt-1 text-xs text-stone-500">
              {(stake.amount_cents / 100).toFixed(0)}€/personne · ≥{stake.min_habit_rate}% habits · max{" "}
              {stake.max_blocks} blocks
            </p>
            <p className="mt-1 text-xs text-stone-600">Status: {stake.status}</p>
          </div>

          <ul className="space-y-2 text-sm">
            {stake.entries.map((e) => (
              <li key={e.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
                <span>{memberNames[e.member_id] ?? "Member"}</span>
                <span className={e.funded ? "text-green-400" : "text-stone-500"}>
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
                placeholder="ton@email.com (Escrow)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-premium w-full"
              />
              <button type="button" onClick={fundStake} className="btn-primary w-full">
                Déposer via Escrow
              </button>
              {escrowUrl && (
                <a href={escrowUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline">
                  Ouvrir la transaction Escrow →
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-stone-600">
              Escrow non configuré — ajoute ESCROW_API_KEY + ESCROW_EMAIL dans web/.env.local (sandbox: ESCROW_SANDBOX=1)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
