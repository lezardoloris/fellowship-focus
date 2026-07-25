import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { listClientRules, upsertClientRule, deleteClientRule } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

// E5-S2 — attribution rules (app/site/window-title → client). The desktop and
// session-close paths use suggestClientForApp() to PRE-FILL, never to commit.
export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  return jsonOk({ rules: listClientRules(member.id) });
}

export async function POST(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const body = await request.json();
  if (!body.client_id || !body.pattern) {
    return jsonErr("client_id and pattern required", 400);
  }
  const rule = upsertClientRule(member.id, {
    client_id: body.client_id,
    match_type: body.match_type || "contains",
    pattern: String(body.pattern),
    id: body.id,
  });
  return jsonOk(rule, body.id ? 200 : 201);
}

export async function DELETE(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonErr("id required", 400);
  return jsonOk({ deleted: deleteClientRule(member.id, id) });
}
