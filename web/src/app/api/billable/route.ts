import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { billableSummary, exportTimesheetCsv, addOfflineTime } from "@/lib/backlog";
import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/apiAuth";

export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const url = new URL(request.url);
  const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const from =
    url.searchParams.get("from") ||
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const clientId = url.searchParams.get("client_id") || undefined;
  if (url.searchParams.get("format") === "csv") {
    const csv = exportTimesheetCsv(member.id, from, to, clientId);
    return new NextResponse(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="timesheet-${from}-${to}.csv"`,
      },
    });
  }
  return jsonOk(billableSummary(member.id, from, to));
}

export async function POST(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const body = await request.json();
  if (!body.date || !body.minutes) return jsonErr("date and minutes required", 400);
  return jsonOk(addOfflineTime(member.id, body), 201);
}
