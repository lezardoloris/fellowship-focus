import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Weekly digest cron — opt-in members only.
 * Auth: Authorization: Bearer $CRON_SECRET
 * Email delivery is best-effort when RESEND_API_KEY or BREVO_API_KEY is set.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const database = getDb();
  const prefs = database
    .prepare("SELECT member_id, settings_json FROM member_prefs")
    .all() as Array<{ member_id: string; settings_json: string }>;

  const optedIn: string[] = [];
  for (const p of prefs) {
    try {
      const s = JSON.parse(p.settings_json || "{}") as { email_digest_opt_in?: boolean };
      if (s.email_digest_opt_in) optedIn.push(p.member_id);
    } catch {
      /* ignore */
    }
  }

  // Resolve emails via google_users
  const emails: string[] = [];
  for (const mid of optedIn) {
    const gu = database
      .prepare("SELECT email FROM google_users WHERE member_id = ?")
      .get(mid) as { email: string } | undefined;
    if (gu?.email) emails.push(gu.email);
  }

  let sent = 0;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL || "Fellowship Focus <noreply@fellowship.focus>";

  if (resendKey && emails.length) {
    for (const email of emails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: email,
            subject: "Your weekly focus digest",
            html: `<p>Your week in focus is ready.</p><p><a href="${process.env.NEXTAUTH_URL || "https://fellowship.focus"}">Open weekly review →</a></p>`,
          }),
        });
        if (res.ok) sent += 1;
      } catch {
        /* continue */
      }
    }
  }

  return NextResponse.json({
    opted_in: optedIn.length,
    emails: emails.length,
    sent,
  });
}
