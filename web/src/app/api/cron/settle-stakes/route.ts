import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { listActiveStakesForCron } from "@/lib/db";
import { settleStakeEscrow } from "@/lib/stakesSettle";

export const runtime = "nodejs";

/**
 * Sunday (or anytime) batch settle. Protect with CRON_SECRET:
 *   GET /api/cron/settle-stakes?key=CRON_SECRET
 * Railway cron → hit this URL weekly.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  const expected = process.env.CRON_SECRET || process.env.ESCROW_WEBHOOK_KEY;
  if (!expected || !key) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const a = Buffer.from(key);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stakes = listActiveStakesForCron();
  const results = [];
  for (const s of stakes) {
    // Only auto-settle if week_start is before current ISO week (Mon).
    const weekStart = s.week_start;
    const nowWeek = mondayIso();
    if (weekStart >= nowWeek) {
      results.push({ id: s.id, skipped: "current week still open" });
      continue;
    }
    try {
      const r = await settleStakeEscrow(s.fellowship_id);
      results.push({
        id: s.id,
        settled: Boolean(r.stake),
        note: r.stake?.settlement_note,
        refunds: r.refunds.length,
        captures: r.captures.length,
        payouts: r.payouts.length,
      });
    } catch (e) {
      results.push({ id: s.id, error: e instanceof Error ? e.message : "fail" });
    }
  }
  return NextResponse.json({ ok: true, results });
}

function mondayIso(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
