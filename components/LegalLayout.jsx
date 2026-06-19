import Link from "next/link";
import { LEGAL } from "@/lib/legal";

// Shared chrome for the static legal/trust pages (/privacy, /terms, /refunds, /cookies, /aup,
// /accessibility, /legal/*). Server component (no "use client") so these pages are fully
// crawlable and need no JS. Inherits the global theme (data-theme on <html>) and color tokens
// from globals.css.
//
// NOTE (for the operator/counsel, not rendered): these pages are a good-faith starting point
// and have not been reviewed by qualified legal counsel; review is recommended. Entity details
// live in lib/legal.js — items still shown as [bracketed] (e.g. the registered address) must be
// completed once the business is registered.
export default function LegalLayout({ title, lastUpdated = LEGAL.lastUpdated, note, children }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          maxWidth: 820,
          margin: "0 auto",
          padding: "22px 24px",
        }}
      >
        <Link href="/" className="np-brand" style={{ fontWeight: 800, fontSize: 20, textDecoration: "none", color: "var(--text)" }}>
          noob<span className="np-arrow">→</span>topro
        </Link>
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>
          ← Back to noobtopro
        </Link>
      </header>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "8px 24px 80px" }}>
        {note && (
          <div
            role="note"
            style={{
              border: "1px solid var(--line)",
              background: "var(--tint-1)",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 13.5,
              color: "var(--muted)",
              marginBottom: 28,
            }}
          >
            {note}
          </div>
        )}

        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 6px", letterSpacing: "-0.02em" }}>{title}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 32px" }}>Last updated: {lastUpdated}</p>

        <article className="np-legal" style={{ fontSize: 15.5, lineHeight: 1.7 }}>
          {children}
        </article>

        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "48px 0 20px" }} />
        <nav style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 14 }} aria-label="Legal pages">
          <Link href="/legal" style={{ color: "var(--muted)", textDecoration: "none" }}>All policies</Link>
          <Link href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "var(--muted)", textDecoration: "none" }}>Terms</Link>
          <Link href="/refunds" style={{ color: "var(--muted)", textDecoration: "none" }}>Refunds</Link>
          <Link href="/cookies" style={{ color: "var(--muted)", textDecoration: "none" }}>Cookies</Link>
          <Link href="/aup" style={{ color: "var(--muted)", textDecoration: "none" }}>Acceptable Use</Link>
          <Link href="/accessibility" style={{ color: "var(--muted)", textDecoration: "none" }}>Accessibility</Link>
          <Link href="/legal/notice" style={{ color: "var(--muted)", textDecoration: "none" }}>Legal Notice</Link>
        </nav>
      </main>
    </div>
  );
}

// Small section helper so each page reads as data, not markup.
export function Section({ heading, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 10px", letterSpacing: "-0.01em" }}>{heading}</h2>
      {children}
    </section>
  );
}
