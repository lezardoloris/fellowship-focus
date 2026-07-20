import { NextResponse } from "next/server";
import { getMemberByToken, toggleHabitCheckin } from "@/lib/db";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: cors });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token as string;
    const habitId = body.habitId as string;
    const date = (body.date as string) || new Date().toISOString().slice(0, 10);

    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: cors });
    }

    const result = toggleHabitCheckin(member.id, habitId, date, member.fellowship_id);
    return NextResponse.json(result, { headers: cors });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400, headers: cors }
    );
  }
}
