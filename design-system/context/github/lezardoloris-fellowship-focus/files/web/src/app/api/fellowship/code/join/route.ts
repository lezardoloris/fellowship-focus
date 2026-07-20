import { NextResponse } from "next/server";
import { getFellowshipByCode, joinFellowship } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const fellowship = getFellowshipByCode(code);
    if (!fellowship) {
      return NextResponse.json({ error: "Fellowship not found" }, { status: 404 });
    }

    const body = await request.json();
    const name = (body.name as string)?.trim();
    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    const member = joinFellowship(fellowship.id, name);
    return NextResponse.json({ member, fellowship });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to join fellowship" }, { status: 500 });
  }
}
