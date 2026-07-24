import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { getSessionRecap } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const { id } = await ctx.params;
  const recap = getSessionRecap(member.id, id);
  if (!recap) return jsonErr("Session not found", 404);
  return jsonOk(recap);
}
