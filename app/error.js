"use client";

// App Router error boundary: catches uncaught render/runtime errors in the tree
// so the user sees a recoverable message instead of a white screen.
export default function Error({ error, reset }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 14,
        padding: "48px 24px",
      }}
    >
      <h1 style={{ fontFamily: "var(--display, Georgia, serif)", fontSize: 28, margin: 0 }}>
        Something went wrong
      </h1>
      <p style={{ color: "var(--muted, #94a0b3)", maxWidth: "48ch", margin: 0 }}>
        An unexpected error interrupted the page. Your saved progress is safe.
      </p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: 8,
          border: "none",
          borderRadius: 11,
          padding: "12px 22px",
          fontWeight: 600,
          fontSize: 15,
          cursor: "pointer",
          background: "var(--text, #ECECE4)",
          color: "var(--bg, #0a0d13)",
        }}
      >
        Try again
      </button>
    </div>
  );
}
