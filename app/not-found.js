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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: "#56897e",
        }}
      >
        <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
          <path
            d="M15 32h31M34 19l13 13-13 13"
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
        404 — page not found
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)", maxWidth: "44ch", margin: 0 }}>
        This page took a wrong turn on the way from noob to pro. The link may be broken or the page may have moved.
      </p>

      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          marginTop: 4,
          padding: "10px 20px",
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          background: "var(--text)",
          color: "var(--text-inverse)",
        }}
      >
        Back to noobtopro
      </Link>
    </main>
  );
}
