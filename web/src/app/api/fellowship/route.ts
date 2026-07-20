import { NextResponse } from "next/server";
import { createFellowship } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name as string)?.trim() || "The Fellowship";
    const fellowship = createFellowship(name);
    return NextResponse.json({ fellowship });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create fellowship" }, { status: 500 });
  }
}
