import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { getDb } from "@/lib/db";
import { nanoid } from "nanoid";

/** E9 — Focusmate-like matching (scaffold). */
export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const rows = getDb()
    .prepare(
      `SELECT * FROM focus_matches
       WHERE status = 'open' OR host_member_id = ? OR guest_member_id = ?
       ORDER BY created_at DESC LIMIT 20`
    )
    .all(member.id, member.id);
  return jsonOk({ matches: rows });
}

export async function POST(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const body = await request.json();
  const id = nanoid();
  const duration = Math.min(90, Math.max(25, Number(body.duration_min) || 50));
  getDb()
    .prepare(
      `INSERT INTO focus_matches
         (id, fellowship_id, host_member_id, duration_min, status, intention)
       VALUES (?, ?, ?, ?, 'open', ?)`
    )
    .run(
      id,
      member.fellowship_id,
      member.id,
      duration,
      typeof body.intention === "string" ? body.intention.slice(0, 85) : null
    );
  return jsonOk(getDb().prepare("SELECT * FROM focus_matches WHERE id = ?").get(id), 201);
}
