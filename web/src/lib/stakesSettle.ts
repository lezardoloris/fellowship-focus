/**
 * Settle a weekly goal bet: score outcomes, refund winners via Escrow cancel,
 * capture loser deposits, then create pot-share payouts to winners.
 */

import {
  captureStakeDeposit,
  createPotPayout,
  escrowConfigured,
  escrowTransactionUrl,
  refundStakeDeposit,
} from "@/lib/escrow";
import {
  addFeedEvent,
  evaluateStakeOutcomes,
  getStakeById,
  type Stake,
  type StakeEntry,
  updateStakeEntrySettlement,
  updateStakeSettlement,
} from "@/lib/db";

export type SettlementResult = {
  stake: (Stake & { entries: StakeEntry[] }) | null;
  refunds: { entryId: string; txId: string; ok: boolean; error?: string }[];
  captures: { entryId: string; txId: string; ok: boolean; step?: string; error?: string }[];
  payouts: { email: string; amountEur: number; txId?: string; url?: string; ok: boolean; error?: string }[];
};

export async function settleStakeEscrow(fellowshipId: string): Promise<SettlementResult> {
  const scored = evaluateStakeOutcomes(fellowshipId);
  if (!scored) {
    return { stake: null, refunds: [], captures: [], payouts: [] };
  }

  const refunds: SettlementResult["refunds"] = [];
  const captures: SettlementResult["captures"] = [];
  const payouts: SettlementResult["payouts"] = [];

  if (!escrowConfigured()) {
    updateStakeSettlement(scored.id, "settled_db_only", "Escrow not configured — outcomes recorded only");
    return { stake: getStakeById(scored.id), refunds, captures, payouts };
  }

  const funded = scored.entries.filter((e) => e.funded && e.escrow_transaction_id);
  const winners = funded.filter((e) => e.outcome === "winner");
  const losers = funded.filter((e) => e.outcome === "forfeited" || e.outcome === "partial");

  for (const entry of winners) {
    const txId = entry.escrow_transaction_id!;
    try {
      await refundStakeDeposit(txId);
      updateStakeEntrySettlement(entry.id, "refunded");
      refunds.push({ entryId: entry.id, txId, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "refund failed";
      updateStakeEntrySettlement(entry.id, "refund_failed", msg);
      refunds.push({ entryId: entry.id, txId, ok: false, error: msg });
    }
  }

  let potCents = 0;
  for (const entry of losers) {
    const txId = entry.escrow_transaction_id!;
    const share =
      entry.outcome === "partial" ? Math.round(scored.amount_cents * 0.5) : scored.amount_cents;
    const result = await captureStakeDeposit(txId);
    if (result.ok || result.step === "shipped_awaiting_buyer") {
      // Count toward pot when shipped/accepted; buyer may still need to click receive.
      potCents += share;
      updateStakeEntrySettlement(
        entry.id,
        result.ok ? "captured" : "capture_pending_buyer",
        result.error
      );
      captures.push({
        entryId: entry.id,
        txId,
        ok: result.ok,
        step: result.step,
        error: result.error,
      });
    } else {
      updateStakeEntrySettlement(entry.id, "capture_failed", result.error);
      captures.push({
        entryId: entry.id,
        txId,
        ok: false,
        step: result.step,
        error: result.error,
      });
    }
  }

  if (winners.length > 0 && potCents > 0) {
    const perWinner = Math.floor(potCents / winners.length) / 100;
    for (const w of winners) {
      if (!w.email || perWinner < 0.5) continue;
      try {
        const tx = await createPotPayout({
          winnerEmail: w.email,
          amountEur: perWinner,
          description: `${scored.title} — pot share`,
        });
        const url = escrowTransactionUrl(tx.id);
        updateStakeEntrySettlement(w.id, "refunded_plus_payout", `payout tx ${tx.id}`);
        payouts.push({
          email: w.email,
          amountEur: perWinner,
          txId: String(tx.id),
          url,
          ok: true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "payout failed";
        payouts.push({ email: w.email, amountEur: perWinner, ok: false, error: msg });
      }
    }
  }

  const note = [
    `${winners.length} winner(s)`,
    `${losers.length} loser(s)`,
    `pot €${(potCents / 100).toFixed(2)}`,
    `${payouts.filter((p) => p.ok).length} payout(s)`,
  ].join(" · ");
  updateStakeSettlement(scored.id, "settled", note);

  const creator = "Fellowship";
  addFeedEvent(
    fellowshipId,
    "stake",
    creator,
    `Weekly stake settled: ${note}.`
  );

  return { stake: getStakeById(scored.id), refunds, captures, payouts };
}
