// ---------------------------------------------------------------------------
// Transactional email via Resend's REST API — NO SDK dependency (a plain fetch), so nothing to
// install. DORMANT until configured: if RESEND_API_KEY / EMAIL_FROM are unset, sendEmail() returns
// { sent:false, reason:"not_configured" } WITHOUT throwing, so callers (e.g. the Art 11a withdrawal
// acknowledgement) degrade gracefully and never block the user flow. Server-only.
//
// To activate: set RESEND_API_KEY and EMAIL_FROM (e.g. 'noobtopro <noreply@noobto.pro>').
// ---------------------------------------------------------------------------

export function isEmailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// Send a plain-text email. Returns { sent:boolean, reason? }; never throws.
export async function sendEmail({ to, subject, text, replyTo } = {}) {
  if (!isEmailConfigured()) return { sent: false, reason: "not_configured" };
  if (!to || !subject || !text) return { sent: false, reason: "missing_fields" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[email] send failed", res.status);
      return { sent: false, reason: "send_failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] send threw", e);
    return { sent: false, reason: "error" };
  }
}
