import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { addDailyHighlight, listDailyHighlights } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  return jsonOk({ highlights: listDailyHighlights(member.id) });
}

export async function POST(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const body = await request.json();
  if (!body.text) return jsonErr("text required", 400);
  return jsonOk(addDailyHighlight(member.id, body.text, body.date), 201);
}
