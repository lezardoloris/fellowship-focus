import { NextResponse } from "next/server";
import { createStakeDeposit, escrowConfigured, escrowTransactionUrl, getAgreeLink } from "@/lib/escrow";
import {
  createStake,
  getActiveStake,
  getLatestStake,
  getMemberByToken,
  getFellowshipByCode,
  joinStakeEntry,
} from "@/lib/db";
import { settleStakeEscrow } from "@/lib/stakesSettle";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GOAL_PRESETS: Record<string, { label: string; minHabitRate: number; maxBlocks: number }> = {
  habits: { label: "Hit ≥70% habit score", minHabitRate: 70, maxBlocks: 5 },
  clean: { label: "Max 2 block hits all week", minHabitRate: 50, maxBlocks: 2 },
  grind: { label: "≥85% habits + max 5 blocks", minHabitRate: 85, maxBlocks: 5 },
  github: { label: "GitHub coding week (habits ≥50% + ship commits)", minHabitRate: 50, maxBlocks: 8 },
  custom: { label: "Custom goal", minHabitRate: 70, maxBlocks: 5 },
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: cors });
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("fellowship");
  if (!code) {
    return NextResponse.json({ error: "fellowship code required" }, { status: 400, headers: cors });
  }

  const fellowship = getFellowshipByCode(code);
  if (!fellowship) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: cors });
  }

  const stake = getActiveStake(fellowship.id) ?? getLatestStake(fellowship.id);
  return NextResponse.json(
    {
      stake,
      escrowConfigured: escrowConfigured(),
      sandbox: process.env.ESCROW_SANDBOX === "1",
      goalPresets: GOAL_PRESETS,
    },
    { headers: cors }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token as string;
    const action = body.action as string;

    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: cors });
    }

    if (action === "create") {
      const amountCents = Number(body.amountCents) || 1000;
      const goalType = (body.goalType as string) || "habits";
      const preset = GOAL_PRESETS[goalType] ?? GOAL_PRESETS.habits;
      const goalLabel =
        (body.goalLabel as string)?.trim() ||
        preset.label;
      const minHabitRate = Number(body.minHabitRate) || preset.minHabitRate;
      const maxBlocks = Number(body.maxBlocks) || preset.maxBlocks;
      const title =
        (body.title as string)?.trim() ||
        `Goal bet — €${(amountCents / 100).toFixed(0)}`;

      const existing = getActiveStake(member.fellowship_id);
      if (existing) {
        return NextResponse.json(
          { error: "A stake is already open this week", stake: existing },
          { status: 409, headers: cors }
        );
      }

      const stake = createStake(
        member.fellowship_id,
        member.id,
        title,
        amountCents,
        minHabitRate,
        maxBlocks,
        goalLabel,
        goalType
      );
      return NextResponse.json({ stake, escrowConfigured: escrowConfigured() }, { headers: cors });
    }

    if (action === "fund") {
      const stakeId = body.stakeId as string;
      const email = (body.email as string)?.trim();
      if (!email) {
        return NextResponse.json({ error: "Email required for Escrow" }, { status: 400, headers: cors });
      }

      let escrowUrl: string | null = null;
      let agreeUrl: string | null = null;
      let txId: string | null = null;

      if (!escrowConfigured()) {
        return NextResponse.json(
          { error: "Escrow is not configured on this server" },
          { status: 503, headers: cors }
        );
      }

      const stake = getActiveStake(member.fellowship_id);
      if (!stake || stake.id !== stakeId) {
        return NextResponse.json({ error: "Stake not found" }, { status: 404, headers: cors });
      }

      const tx = await createStakeDeposit({
        memberEmail: email,
        description: `${stake.title} — ${stake.goal_label}`,
        amountEur: stake.amount_cents / 100,
      });
      txId = String(tx.id);
      escrowUrl = escrowTransactionUrl(tx.id);
      agreeUrl = await getAgreeLink(tx.id);

      joinStakeEntry(stakeId, member.id, email, txId);
      return NextResponse.json(
        {
          pending: true,
          funded: false,
          escrowUrl,
          agreeUrl,
          escrowTransactionId: txId,
          message: "Agree & pay on Escrow.com. We’ll mark you funded when payment is secured.",
        },
        { headers: cors }
      );
    }

    if (action === "settle") {
      const result = await settleStakeEscrow(member.fellowship_id);
      if (!result.stake) {
        return NextResponse.json({ error: "No active stake to settle" }, { status: 404, headers: cors });
      }
      return NextResponse.json(result, { headers: cors });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400, headers: cors });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500, headers: cors }
    );
  }
}
