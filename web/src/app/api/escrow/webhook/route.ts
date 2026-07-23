import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { fundsSecured, getEscrowTransaction, escrowConfigured } from "@/lib/escrow";
import { markStakeEntryFunded, addFeedEvent, getStakeById } from "@/lib/db";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Escrow.com webhook. Register:
 *   POST https://YOUR_HOST/api/escrow/webhook?key=ESCROW_WEBHOOK_KEY
 * Never trust the payload alone — re-fetch the transaction and check funds secured.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const expected = process.env.ESCROW_WEBHOOK_KEY;
  if (!expected || !key || !safeEqual(key, expected)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!escrowConfigured()) {
    return NextResponse.json({ ok: true, skipped: "escrow not configured" });
  }

  const body = (await request.json().catch(() => ({}))) as {
    transaction_id?: number | string;
    event?: string;
  };
  const txId = body.transaction_id;
  if (!txId) return NextResponse.json({ ok: true });

  try {
    const t = await getEscrowTransaction(txId);
    if (!fundsSecured(t)) {
      return NextResponse.json({ ok: true, funded: false });
    }
    const entry = markStakeEntryFunded(String(txId));
    if (entry) {
      const stake = getStakeById(entry.stake_id);
      if (stake) {
        addFeedEvent(
          stake.fellowship_id,
          "stake",
          "Escrow",
          `Deposit secured for goal bet “${stake.title}”.`
        );
      }
    }
    return NextResponse.json({ ok: true, funded: Boolean(entry) });
  } catch (e) {
    console.error("[escrow/webhook]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: true, error: "lookup failed" });
  }
}
