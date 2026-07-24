import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { buildSharePayload, countFocusingNow } from "@/lib/backlog";

/** E8 — Shareable session card payload (+ optional OG-friendly HTML later). */
export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return jsonErr("session_id required", 400);
  const share = buildSharePayload(member.id, sessionId);
  if (!share) return jsonErr("Session not found", 404);
  return jsonOk({
    ...share,
    focusing_now: countFocusingNow(),
    url: `${url.origin}/share/session/${sessionId}`,
  });
}
