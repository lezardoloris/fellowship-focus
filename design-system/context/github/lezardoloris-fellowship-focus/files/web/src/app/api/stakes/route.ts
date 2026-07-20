import { NextResponse } from "next/server";
import {
  createStake,
  getActiveStake,
  getMemberByToken,
  joinStakeEntry,
} from "@/lib/db";
import { createStakeDeposit, escrowConfigured, escrowTransactionUrl } from "@/lib/escrow";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: cors });
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("fellowship");
  if (!code) {
    return NextResponse.json({ error: "fellowship code required" }, { status: 400, headers: cors });
  }

  const { getFellowshipByCode } = await import("@/lib/db");
  const fellowship = getFellowshipByCode(code);
  if (!fellowship) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: cors });
  }

  const stake = getActiveStake(fellowship.id);
  return NextResponse.json(
    { stake, escrowConfigured: escrowConfigured() },
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
      const title = (body.title as string) || "Weekly Ring Deposit";
      const amountCents = Number(body.amountCents) || 1000;
      const minHabitRate = Number(body.minHabitRate) || 70;
      const maxBlocks = Number(body.maxBlocks) || 5;

      const stake = createStake(
        member.fellowship_id,
        member.id,
        title,
        amountCents,
        minHabitRate,
        maxBlocks
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
      let txId: string | null = null;

      if (escrowConfigured()) {
        const stake = getActiveStake(member.fellowship_id);
        if (!stake || stake.id !== stakeId) {
          return NextResponse.json({ error: "Stake not found" }, { status: 404, headers: cors });
        }
        const tx = await createStakeDeposit({
          memberEmail: email,
          description: `${stake.title} — Fellowship Focus`,
          amountEur: stake.amount_cents / 100,
        });
        txId = String(tx.id);
        escrowUrl = escrowTransactionUrl(tx.id);
      }

      joinStakeEntry(stakeId, member.id, email, txId ?? undefined);
      return NextResponse.json({ funded: true, escrowUrl, escrowTransactionId: txId }, { headers: cors });
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
