import { NextResponse } from "next/server";
import { getMemberByToken, getProofById } from "@/lib/db";
import { readProofThumb } from "@/lib/proofs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401 });
    }
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const proof = getProofById(id);
    // Privacy-first: a member can only access their own evidence thumbnails.
    if (
      !proof ||
      proof.fellowship_id !== member.fellowship_id ||
      proof.member_id !== member.id
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (proof.privacy_tier === "signal" || !proof.thumb_path) {
      return NextResponse.json({ error: "No image for this proof tier" }, { status: 404 });
    }

    const buf = readProofThumb(proof.thumb_path);
    if (!buf) {
      return NextResponse.json({ error: "File missing" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load proof" }, { status: 500 });
  }
}
