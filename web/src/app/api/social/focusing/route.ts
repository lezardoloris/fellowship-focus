import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { countFocusingNow, buildSharePayload } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const globalCount = countFocusingNow();
  const guildCount = countFocusingNow(member.fellowship_id);
  const share = sessionId ? buildSharePayload(member.id, sessionId) : null;
  return jsonOk({
    focusing_now: globalCount,
    focusing_in_guild: guildCount,
    share,
  });
}
