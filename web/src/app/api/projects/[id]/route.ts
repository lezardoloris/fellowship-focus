import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { updateProject } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const { id } = await ctx.params;
  const body = await request.json();
  const project = updateProject(member.id, id, body);
  if (!project) return jsonErr("Not found", 404);
  return jsonOk(project);
}
