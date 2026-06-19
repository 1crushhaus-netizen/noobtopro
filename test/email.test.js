import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sendEmail, isEmailConfigured } from "@/lib/email";

// The mailer must be DORMANT until RESEND_API_KEY/EMAIL_FROM are set, never throwing, so the
// withdrawal flow degrades gracefully when email isn't configured yet.
describe("lib/email — dormant until configured", () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  beforeEach(() => { delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; });
  afterEach(() => {
    if (saved.key) process.env.RESEND_API_KEY = saved.key; else delete process.env.RESEND_API_KEY;
    if (saved.from) process.env.EMAIL_FROM = saved.from; else delete process.env.EMAIL_FROM;
  });
  it("reports not configured and no-ops without throwing or fetching", async () => {
    expect(isEmailConfigured()).toBe(false);
    const r = await sendEmail({ to: "a@b.com", subject: "x", text: "y" });
    expect(r).toEqual({ sent: false, reason: "not_configured" });
  });
});
