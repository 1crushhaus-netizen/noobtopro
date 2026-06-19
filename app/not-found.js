import Link from "next/link";

// On-brand 404. Server component; inherits globals.css theme tokens so it tracks
// the active light/dark theme set by the pre-paint THEME_INIT in layout.js.
export const metadata = { title: "Page not found" }; // root template appends " — noobtopro"

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "48px 24px",
        textAlign: "center",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      {/* On-brand greyscale mark: the wordmark arrow on a neutral surface (no chromatic
          accent — the page is strictly greyscale like the rest of the app). */}
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: "var(--radius-elevated)",
          background: "var(--tint-2)",
          border: "1px solid var(--line-strong)",
          color: "var(--text)",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
          <path
            d="M15 32h31M34 19l13 13-13 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="np-h1" style={{ margin: 0 }}>404 — page not found</h1>
      <p className="np-lede" style={{ margin: 0, maxWidth: "44ch" }}>
        This page took a wrong turn on the way from noob to pro. The link may be broken or the page may have moved.
      </p>

      <Link href="/" className="np-btn np-primary" style={{ marginTop: 4 }}>
        Back to noobtopro
      </Link>
    </main>
  );
}
