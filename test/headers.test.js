import { describe, it, expect } from "vitest";
import nextConfig from "@/next.config.js";

// Locks in the response security headers (next.config.js). Regression guard so the
// CSP and framing/sniff/HSTS protections can't be silently dropped or weakened.
describe("security response headers", () => {
  it("applies the headers to every route", async () => {
    const rules = await nextConfig.headers();
    const all = rules.find((r) => r.source === "/:path*");
    expect(all).toBeTruthy();
  });

  it("emits a baseline CSP with the locked-down directives", async () => {
    const rules = await nextConfig.headers();
    const headers = rules.find((r) => r.source === "/:path*").headers;
    const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value || "";
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
