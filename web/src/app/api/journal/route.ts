import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { listSessionJournal } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const url = new URL(request.url);
  return jsonOk({
    entries: listSessionJournal(member.id, {
      notesOnly: url.searchParams.get("notes_only") === "1",
      clientId: url.searchParams.get("client_id") || undefined,
      limit: Number(url.searchParams.get("limit")) || 50,
    }),
  });
}
