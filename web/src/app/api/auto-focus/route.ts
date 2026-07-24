import { memberFromRequest, optionsOk, jsonOk, jsonErr } from "@/lib/apiAuth";
import { getDailyFocusTarget } from "@/lib/backlog";
import { getBlockerSettings } from "@/lib/db";

/**
 * E10 — Auto-trigger suggestions (calendar zones + distraction threshold).
 * Full Google Calendar sync is opt-in later; this returns heuristic nudges.
 */
export async function OPTIONS() {
  return optionsOk();
}

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return jsonErr("Token required", 401);
  const settings = getBlockerSettings(member.id);
  const target = getDailyFocusTarget(member.id);
  const suggestions: Array<{ type: string; message: string }> = [];

  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 11) {
    suggestions.push({
      type: "focus_zone",
      message: "Morning focus zone — start a deep block?",
    });
  }
  if (hour >= 14 && hour <= 16) {
    suggestions.push({
      type: "focus_zone",
      message: "Afternoon focus zone looks open.",
    });
  }

  for (const rule of settings.schedules || []) {
    suggestions.push({
      type: "schedule",
      message: `Scheduled: ${rule.label || "focus window"} ${rule.start}–${rule.end}`,
    });
  }

  suggestions.push({
    type: "daily_target",
    message: `Daily focus target: ${target} min`,
  });

  return jsonOk({
    suggestions,
    tag_hint: "Tag calendar events with #focus to auto-start (coming soon)",
  });
}
