import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { moneySummary, projectProfitability } from "@/lib/backlog";

export async function OPTIONS() {
  return optionsOk();
}

// The DataFast-style money view: what makes me money and how much time it got.
// ?window=week (default) | month | custom (&from=&to=)
export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const url = new URL(request.url);
  const win = url.searchParams.get("window") || "week";
  const today = new Date().toISOString().slice(0, 10);
  let from = url.searchParams.get("from") || "";
  let to = url.searchParams.get("to") || today;
  if (!from) {
    const days = win === "month" ? 30 : 7;
    from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  }
  const summary = moneySummary(member.id, from, to);
  // Previous window of the same length, for deltas ("vs last week").
  const spanDays = Math.max(
    1,
    Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1
  );
  const prevTo = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(from) - spanDays * 86400000)
    .toISOString()
    .slice(0, 10);
  const prev = moneySummary(member.id, prevFrom, prevTo);
  return jsonOk({
    ...summary,
    prev: {
      total_cents: prev.total_cents,
      billable_pct: prev.billable_pct,
      effective_rate_cents: prev.effective_rate_cents,
      tracked_minutes: prev.tracked_minutes,
    },
    profitability: projectProfitability(member.id).rows,
  });
}
