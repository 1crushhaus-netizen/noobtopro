"use client";

import React from "react";

/* ----------------------------- icons (inline, no deps) -----------------------------
   Shared inline-SVG icon set used across the app (the main flow in Noobtopro and the
   Dashboard tab). Stroke icons inherit `currentColor`; `spark`/`google`/`lock` are
   filled glyphs. */
export default function Icon({ name, size = 16 }) {
  const c = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (name === "arrow") return <svg {...c}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "back") return <svg {...c}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
  if (name === "x") return <svg {...c}><path d="M6 6l12 12M18 6 6 18" /></svg>;
  if (name === "clip") return <svg {...c}><path d="M21.4 11.05 12.25 20.2a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;
  if (name === "bulb") return <svg {...c}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z" /></svg>;
  if (name === "refresh") return <svg {...c}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" /></svg>;
  if (name === "search") return <svg {...c}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
  if (name === "sun") return <svg {...c}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>;
  if (name === "moon") return <svg {...c}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
  if (name === "monitor") return <svg {...c}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
  if (name === "target") return <svg {...c}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
  if (name === "book") return <svg {...c}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>;
  if (name === "grid") return <svg {...c}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (name === "shield") return <svg {...c}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
  if (name === "flag") return <svg {...c}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg>;
  if (name === "login") return <svg {...c}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>;
  if (name === "logout") return <svg {...c}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
  if (name === "lock") return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5a4.5 4.5 0 0 0-4.5 4.5V9H6.75A1.75 1.75 0 0 0 5 10.75v9.5C5 21.22 5.78 22 6.75 22h10.5c.97 0 1.75-.78 1.75-1.75v-9.5C19 9.78 18.22 9 17.25 9H16.5V6A4.5 4.5 0 0 0 12 1.5Zm2.5 7.5h-5V6a2.5 2.5 0 0 1 5 0v3Z" /></svg>;
  if (name === "spark") return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" /></svg>;
  if (name === "google") return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 10.04H12v3.96h5.62c-.25 1.34-1 2.48-2.13 3.24v2.69h3.45c2.02-1.86 3.18-4.6 3.18-7.85 0-.73-.07-1.43-.2-2.08z" /><path d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.45-2.69c-.96.64-2.18 1.02-3.17 1.02-2.6 0-4.8-1.76-5.59-4.12H2.84v2.78A10 10 0 0 0 12 22z" /><path d="M6.41 13.78a6 6 0 0 1 0-3.56V7.44H2.84a10 10 0 0 0 0 9.12z" /><path d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2 10 10 0 0 0 2.84 7.44l3.57 2.78C7.2 7.74 9.4 5.98 12 5.98z" /></svg>;
  return null;
}
