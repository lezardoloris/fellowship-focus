import { NextResponse } from "next/server";
import { getFellowshipByCode, joinFellowship } from "@/lib/db";
import { allowRate, clientKey } from "@/lib/rateLimit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!allowRate(clientKey(request, `join:${code.toLowerCase()}`), 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many join attempts. Try again later." },
        { status: 429 }
      );
    }
    const fellowship = getFellowshipByCode(code);
    if (!fellowship) {
      return NextResponse.json({ error: "Fellowship not found" }, { status: 404 });
    }

    const body = await request.json();
    const name = (body.name as string)?.trim();
    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    // Plaintext token returned once; DB stores only the hash.
    const { member, plaintextToken } = joinFellowship(fellowship.id, name);
    return NextResponse.json({
      member: { ...member, token: plaintextToken },
      fellowship,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to join fellowship" }, { status: 500 });
  }
}
