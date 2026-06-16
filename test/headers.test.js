import { describe, it, expect } from "vitest";
import nextConfig from "@/next.config.js";
import { buildContentSecurityPolicy } from "@/lib/csp";

// Locks in the response security headers. The CSP is emitted PER-REQUEST (with a nonce) by
// middleware.js via lib/csp.js (red-team Finding 5); the framing/sniff/HSTS protections stay
// static in next.config.js. Regression guard so none can be silently dropped or weakened.
describe("security response headers", () => {
  it("applies the static (non-CSP) headers to every route", async () => {
    const rules = await nextConfig.headers();
    const all = rules.find((r) => r.source === "/:path*");
    expect(all).toBeTruthy();
  });

  it("sets the framing + origin-isolation headers (COOP same-origin)", async () => {
    const rules = await nextConfig.headers();
    const headers = rules.find((r) => r.source === "/:path*").headers;
    const get = (k) => headers.find((h) => h.key === k);
    expect(get("X-Frame-Options")?.value).toBe("DENY");
    // COOP same-origin is safe only because the app uses full-page OAuth/checkout
    // redirects (no window.open). If a popup flow is ever added, revisit this value.
    expect(get("Cross-Origin-Opener-Policy")?.value).toBe("same-origin");
  });

  it("no longer emits a static CSP from next.config (moved to the nonce-based middleware)", async () => {
    const rules = await nextConfig.headers();
    const headers = rules.find((r) => r.source === "/:path*").headers;
    expect(headers.find((h) => h.key === "Content-Security-Policy")).toBeUndefined();
  });

  it("builds a nonce-based CSP with the locked-down directives and NO script 'unsafe-inline'", () => {
    const csp = buildContentSecurityPolicy("test-nonce-abc123");
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/base-uri 'self'/);
    expect(csp).toMatch(/form-action 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    // App dependencies must stay allow-listed or the live app breaks.
    expect(csp).toMatch(/font-src[^;]*fonts\.gstatic\.com/);
    expect(csp).toMatch(/style-src[^;]*fonts\.googleapis\.com/);
    expect(csp).toMatch(/connect-src[^;]*\*\.supabase\.co/);
    expect(csp).toMatch(/img-src[^;]*blob:/); // diagnostic photo previews
    // Finding 5: the nonce is present and 'unsafe-inline' is gone from script-src (a browser
    // ignores 'unsafe-inline' once a nonce is present, so an injected inline script is blocked).
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toMatch(/'nonce-test-nonce-abc123'/);
    expect(scriptSrc).not.toMatch(/'unsafe-inline'/);
  });

  it("falls back to 'unsafe-inline' script-src only when no nonce is supplied", () => {
    const scriptSrc = buildContentSecurityPolicy()
      .split(";")
      .find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toMatch(/'unsafe-inline'/);
    expect(scriptSrc).not.toMatch(/'nonce-/);
  });

  it("pins connect-src to the configured Supabase host when the env is set", () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj123.supabase.co";
    try {
      const csp = buildContentSecurityPolicy("n");
      expect(csp).toMatch(/connect-src[^;]*https:\/\/proj123\.supabase\.co wss:\/\/proj123\.supabase\.co/);
      expect(csp).not.toMatch(/\*\.supabase\.co/);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
    }
  });

  it("sets X-Frame-Options: DENY to match the CSP frame-ancestors on legacy browsers", async () => {
    const rules = await nextConfig.headers();
    const headers = rules.find((r) => r.source === "/:path*").headers;
    const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]));
    // Must be DENY (not SAMEORIGIN) so old browsers honoring only X-Frame-Options
    // agree with frame-ancestors 'none' (no framing at all).
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    expect(byKey["Referrer-Policy"]).toBeTruthy();
  });
});
