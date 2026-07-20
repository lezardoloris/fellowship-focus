import { NextResponse } from "next/server";
import { addMemberHabit, getHabitGrid, getMemberByToken, getMemberHabits } from "@/lib/db";
import { HABIT_PRESETS } from "@/lib/habits";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: cors });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const year = Number(new URL(request.url).searchParams.get("year")) || new Date().getFullYear();
  const month = Number(new URL(request.url).searchParams.get("month")) || new Date().getMonth() + 1;

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 401, headers: cors });
  }

  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: cors });
  }

  return NextResponse.json(
    {
      presets: HABIT_PRESETS,
      myHabits: getMemberHabits(member.id),
      grid: getHabitGrid(member.id, year, month),
      year,
      month,
    },
    { headers: cors }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token as string;
    const presetId = body.presetId as string;

    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: cors });
    }

    const habit = addMemberHabit(member.id, member.fellowship_id, presetId);
    if (!habit) {
      return NextResponse.json({ error: "Habit already added or invalid preset" }, { status: 400, headers: cors });
    }

    return NextResponse.json({ habit }, { headers: cors });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to add habit" }, { status: 500, headers: cors });
  }
}
