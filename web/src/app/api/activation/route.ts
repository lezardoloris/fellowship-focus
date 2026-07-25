import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { getActivationFunnel, recordActivation, ACTIVATION_STEPS } from "@/lib/db";
import type { ActivationEvent } from "@/lib/db";

export async function OPTIONS() {
  return optionsOk();
}

// GET → the activation funnel (aggregate, no PII). Any authed member can read
// it; it's product telemetry, not per-user data.
export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  return jsonOk(getActivationFunnel());
}

// POST { event } → record a funnel step for the calling member (idempotent).
// Surfaces emit the steps they alone can see (e.g. desktop cert install).
export async function POST(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const body = await request.json();
  const event = body.event as ActivationEvent;
  if (!ACTIVATION_STEPS.includes(event)) {
    return jsonErr(`event must be one of ${ACTIVATION_STEPS.join(", ")}`, 400);
  }
  recordActivation(member.id, event, body.meta);
  return jsonOk({ ok: true });
}
