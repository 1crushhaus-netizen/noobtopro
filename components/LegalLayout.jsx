import Link from "next/link";

// Shared chrome for the static legal/trust pages (/privacy, /terms, /refunds). Server
// component (no "use client") so these pages are fully crawlable and need no JS. Inherits
// the global theme (data-theme on <html>) and color tokens from globals.css.
//
// NOTE: the page bodies are DRAFT templates. The placeholders in [brackets] — legal entity
// name, jurisdiction, contact address, effective date — MUST be filled and the text
// reviewed by qualified counsel before relying on these for a live, paid, minor-facing
// product. They are a structured starting point, not legal advice.
export default function LegalLayout({ title, lastUpdated = "[Effective Date]", children }) {
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
          <strong style={{ color: "var(--text)" }}>Draft template.</strong> This document is a
          starting point and has not yet been reviewed by legal counsel. Bracketed
          placeholders must be completed before launch. It is not legal advice.
        </div>

        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 6px", letterSpacing: "-0.02em" }}>{title}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 32px" }}>Last updated: {lastUpdated}</p>

        <article className="np-legal" style={{ fontSize: 15.5, lineHeight: 1.7 }}>
          {children}
        </article>

        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "48px 0 20px" }} />
        <nav style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 14 }} aria-label="Legal pages">
          <Link href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: "var(--muted)", textDecoration: "none" }}>Terms of Service</Link>
          <Link href="/refunds" style={{ color: "var(--muted)", textDecoration: "none" }}>Refund &amp; Cancellation</Link>
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
