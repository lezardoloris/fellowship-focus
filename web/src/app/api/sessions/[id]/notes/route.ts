import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { updateSessionNotes } from "@/lib/backlog";

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
  const ok = updateSessionNotes(member.id, id, {
    intention: body.intention,
    reflection: body.reflection,
    goalDone: body.goalDone ?? body.goal_done,
  });
  if (!ok) return jsonErr("Session not found", 404);
  return jsonOk({ ok: true });
}
