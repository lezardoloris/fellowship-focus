import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { listClients, createClient } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  return jsonOk({ clients: listClients(member.id) });
}

export async function POST(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const body = await request.json();
  if (!body.name || typeof body.name !== "string") return jsonErr("name required", 400);
  const client = createClient(member.id, {
    name: body.name,
    hourly_rate_cents: Number(body.hourly_rate_cents) || 0,
    currency: body.currency,
    color: body.color,
  });
  return jsonOk(client, 201);
}
