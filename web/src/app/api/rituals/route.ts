import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { saveRitual, getRitual, getDailyFocusTarget } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const kind = url.searchParams.get("kind") || undefined;
  return jsonOk({
    rituals: getRitual(member.id, date, kind || undefined),
    daily_focus_target_min: getDailyFocusTarget(member.id),
  });
}

export async function POST(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const body = await request.json();
  const kind = body.kind === "shutdown" ? "shutdown" : "morning";
  const date = body.date || new Date().toISOString().slice(0, 10);
  const row = saveRitual(member.id, date, kind, body.payload || body);
  return jsonOk(row, 201);
}
