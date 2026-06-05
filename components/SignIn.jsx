"use client";

import React from "react";

/* Provider glyphs (inline, no deps). */
function ProviderGlyph({ id, size = 18 }) {
  if (id === "google") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21.8 10.04H12v3.96h5.62c-.25 1.34-1 2.48-2.13 3.24v2.69h3.45c2.02-1.86 3.18-4.6 3.18-7.85 0-.73-.07-1.43-.2-2.08z" />
        <path d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.45-2.69c-.96.64-2.18 1.02-3.17 1.02-2.6 0-4.8-1.76-5.59-4.12H2.84v2.78A10 10 0 0 0 12 22z" />
        <path d="M6.41 13.78a6 6 0 0 1 0-3.56V7.44H2.84a10 10 0 0 0 0 9.12z" />
        <path d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2 10 10 0 0 0 2.84 7.44l3.57 2.78C7.2 7.74 9.4 5.98 12 5.98z" />
      </svg>
    );
  }
  if (id === "github") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
      </svg>
    );
  }
  if (id === "discord") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18.3 18.3 0 0 1 4.3 1.4c-2.6-1.2-5.1-1.7-7.5-1.7s-4.9.5-7.5 1.7c1.3-.6 2.8-1.1 4.3-1.4L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1 8.9.3 13.3.6 17.6a19.9 19.9 0 0 0 6.1 3.1l.5-.8c-.8-.3-1.6-.7-2.3-1.2l.6-.4c4.4 2 9.2 2 13.6 0l.6.4c-.7.5-1.5.9-2.3 1.2l.5.8a19.9 19.9 0 0 0 6.1-3.1c.4-5-.7-9.4-3.3-13.2zM8.9 14.9c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.8.9 1.7 1.9c0 1-.8 1.9-1.7 1.9zm6.2 0c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.8.9 1.7 1.9c0 1-.7 1.9-1.7 1.9z" />
      </svg>
    );
  }
  return null;
}

/**
 * The sign-in menu. OAuth providers only — no email/password by design.
 * @param {{providers: Array<{id:string,label:string,enabled:boolean}>, onProvider:(id:string)=>void, onBack:()=>void}} props
 */
export default function SignIn({ providers, onProvider, onBack }) {
  return (
    <div className="fade-up np-signinscreen">
      <button className="np-ghost" style={{ marginBottom: 14 }} onClick={onBack}>← Back</button>
      <h2 className="np-h2">Save your progress</h2>
      <p className="np-lede" style={{ marginBottom: 22 }}>
        Sign in to keep your scores across devices. Identity is handled by your provider — noobtopro never
        sees or stores a password.
      </p>

      <div className="np-providerlist">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            className="np-providerbtn"
            disabled={!p.enabled}
            aria-label={p.enabled ? `Continue with ${p.label}` : `${p.label} sign-in coming soon`}
            onClick={() => p.enabled && onProvider(p.id)}
          >
            <ProviderGlyph id={p.id} />
            <span>Continue with {p.label}</span>
            {!p.enabled && <span className="np-soon">Coming soon</span>}
          </button>
        ))}
      </div>

      <p className="np-hint" style={{ marginTop: 18 }}>
        No passwords, no email sign-up — just your chosen account.
      </p>
    </div>
  );
}
