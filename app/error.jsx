"use client";

import { useEffect } from "react";

// App Router error boundary: catches uncaught render/runtime errors in the tree
// so the user sees a recoverable message instead of a white screen. Styled on
// the np-* primitives + semantic tokens only, so it holds in both themes.
export default function Error({ error, reset }) {
  // Log the caught error so production crashes leave a breadcrumb (console →
  // Vercel runtime logs) instead of vanishing. error.digest correlates a hashed
  // server error to its server-side log entry.
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "var(--space-3)",
        padding: "var(--space-6) var(--space-5)",
      }}
    >
      <h1 className="np-h2" style={{ margin: 0 }}>Something went wrong</h1>
      <p className="np-lede" style={{ margin: 0, maxWidth: "48ch" }}>
        An unexpected error interrupted the page. Your saved progress is safe.
      </p>
      <button
        type="button"
        className="np-btn np-primary"
        style={{ marginTop: "var(--space-2)" }}
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
