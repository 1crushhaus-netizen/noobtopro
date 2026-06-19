"use client";

import Icon from "@/components/Icon";

/* =============================================================================
   BottomNav — mobile-only fixed bottom navigation for the signed-in app's
   primary views (Practice / Learn / Dashboard / Admin).

   It consumes the SAME `tabs` contract as the shared TopNav —
   { id, label, icon, active, onClick } — so a single array drives both. On
   phones the top-nav tab strip used to get squeezed between the brand and the
   theme/sign-out cluster into an unusable, clipped sliver; this bar moves the
   tabs out of that cramped row into a thumb-reachable bottom bar instead.

   Visibility is owned by CSS (.np-bottomnav): hidden above the 640px breakpoint
   (where the top tabs show) and shown at/below it (where the top tabs are
   hidden) — so exactly ONE primary nav is ever visible / in the a11y tree.
   ========================================================================== */
export default function BottomNav({ tabs }) {
  if (!tabs || tabs.length === 0) return null;
  return (
    <nav className="np-bottomnav" aria-label="Primary">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={"np-bottomnav-tab" + (t.active ? " active" : "")}
          aria-current={t.active ? "page" : undefined}
          onClick={t.onClick}
        >
          {t.icon && <Icon name={t.icon} size={20} />}
          <span className="np-bottomnav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
