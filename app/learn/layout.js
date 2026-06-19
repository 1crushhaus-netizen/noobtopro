import Link from "next/link";
import { ORDER } from "@/lib/scoring";
import { subjectLabel, subjectUrl } from "@/lib/learn/seo";

// Shared chrome for the public Learn library (/learn/**). Server component (no
// "use client") so every page is fully crawlable and needs no JavaScript. The
// header/footer give crawlers (and readers) a consistent internal-link frame
// back to the app's funnel ("Take the diagnostic" → "/") and across subjects.
// Colors inherit the global theme tokens from globals.css.
export default function LearnLayout({ children }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)" }}>
      <a href="#learn-content" className="np-skiplink">
        Skip to content
      </a>

      <header
        style={{
          borderBottom: "1px solid var(--line)",
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
        }}
      >
        <div
          style={{
            maxWidth: "var(--w-content)",
            margin: "0 auto",
            padding: "16px clamp(20px, 5vw, 40px)",
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <Link href="/" className="np-brand" style={{ textDecoration: "none", color: "var(--text)" }}>
            noob<span className="np-arrow">→</span>topro
          </Link>
          <nav
            aria-label="Learn library"
            style={{ display: "flex", gap: 18, marginLeft: 6, flexWrap: "wrap" }}
          >
            <Link href="/learn" style={{ color: "var(--muted)", fontSize: 13.5, textDecoration: "none" }}>
              Library
            </Link>
            {ORDER.map((s) => (
              <Link
                key={s}
                href={subjectUrl(s)}
                style={{ color: "var(--muted)", fontSize: 13.5, textDecoration: "none" }}
              >
                {subjectLabel(s)}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="np-btn np-primary np-topnav-cta"
            style={{ marginLeft: "auto", textDecoration: "none" }}
          >
            Take the free diagnostic
          </Link>
        </div>
      </header>

      <main id="learn-content" className="np-main" style={{ padding: "32px clamp(20px, 5vw, 40px) 64px" }}>
        {children}
      </main>

      <footer style={{ borderTop: "1px solid var(--line)", marginTop: 24 }}>
        <div
          style={{
            maxWidth: "var(--w-content)",
            margin: "0 auto",
            padding: "28px clamp(20px, 5vw, 40px)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
            fontSize: 13.5,
            color: "var(--muted)",
          }}
        >
          <Link href="/" className="np-brand" style={{ textDecoration: "none", color: "var(--text)", fontSize: 16 }}>
            noob<span className="np-arrow">→</span>topro
          </Link>
          <span style={{ color: "var(--faint)" }}>Prove what you know. Climb from noob to pro.</span>
          <nav aria-label="Footer" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginLeft: "auto" }}>
            <Link href="/learn" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Library
            </Link>
            <Link href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Terms
            </Link>
            <Link href="/legal" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Legal
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
