import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { updateTask, deleteTask } from "@/lib/backlog";

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
  const task = updateTask(member.id, id, body);
  if (!task) return jsonErr("Not found", 404);
  return jsonOk(task);
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const { id } = await ctx.params;
  if (!deleteTask(member.id, id)) return jsonErr("Not found", 404);
  return jsonOk({ ok: true });
}
