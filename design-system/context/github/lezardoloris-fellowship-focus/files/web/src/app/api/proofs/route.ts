import { NextResponse } from "next/server";
import { addFocusProof, getMemberByToken } from "@/lib/db";
import type { ProofPrivacyTier, ProofType } from "@/lib/proofs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token as string;
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
    }
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    const proofType = (body.proofType as ProofType) || "signal";
    const privacyTier = (body.privacyTier as ProofPrivacyTier) || "signal";
    const sessionId = (body.sessionId as string) || null;
    const activeApp = (body.activeApp as string) || null;
    const imageBase64 = body.imageBase64 as string | undefined;

    if (privacyTier === "signal" && imageBase64) {
      return NextResponse.json({ error: "Signal tier cannot include images" }, { status: 400, headers: corsHeaders });
    }

    const proof = addFocusProof(
      member.id,
      member.fellowship_id,
      sessionId,
      proofType,
      privacyTier,
      activeApp,
      imageBase64
    );

    return NextResponse.json({ proof: { id: proof.id, created_at: proof.created_at } }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save proof" }, { status: 500, headers: corsHeaders });
  }
}
