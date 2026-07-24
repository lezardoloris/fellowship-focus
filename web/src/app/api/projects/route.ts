import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { listProjects, createProject } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") || undefined;
  return jsonOk({ projects: listProjects(member.id, clientId) });
}

export async function POST(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const body = await request.json();
  if (!body.name) return jsonErr("name required", 400);
  return jsonOk(
    createProject(member.id, { name: body.name, client_id: body.client_id }),
    201
  );
}
