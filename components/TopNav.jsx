"use client";

import React, { useState } from "react";
import Icon from "@/components/Icon";
import ThemeToggle from "@/components/ThemeToggle";
import { rankFor, phdIndex } from "@/lib/scoring";

/* =============================================================================
   TopNav — ONE shared sticky top navigation used by BOTH the public landing
   page and the signed-in app. The landing keeps section anchors + a primary
   CTA; the signed-in app shows its view tabs (Practice / Learn / Dashboard /
   Admin) with the active tab styled, plus a compact identity + sign-out. Styled
   from the .np-topnav* layer (sticky, backdrop blur, border-bottom, condense on
   scroll, 1080px inner) so both surfaces read identically.

   Props:
   - scrolled            adds .is-scrolled (the condense-and-firm-up state)
   - onBrand             click handler for the brand (app: restart; landing: omit
                         so the <a href="#top"> scroll-to-top is used)
   - brandHref           when set, the brand renders as an anchor (landing)
   - brandTitle          tooltip on the brand button (app: "Restart")
   - links               [{ label, href }] section anchors (landing)
   - tabs                [{ id, label, icon, active, onClick }] app view tabs
   - actions             arbitrary right-side nodes rendered before the built-ins
   - user / scores       signed-in identity (app) — renders the compact id chip
   - showTheme           render the ThemeToggle (default true)
   - signIn / signOut    { onClick, label } for the auth button
   - cta                 { label, onClick, disabled } primary pill (landing)
   ========================================================================== */
export default function TopNav({
  scrolled = false,
  onBrand,
  brandHref,
  brandTitle,
  links,
  tabs,
  user,
  scores,
  showTheme = true,
  signIn,
  signOut,
  cta,
}) {
  const Brand = brandHref ? (
    <a className="np-brand np-topnav-brand" href={brandHref}>
      noob<span className="np-arrow">→</span>topro
    </a>
  ) : (
    <button className="np-brand np-topnav-brand" onClick={onBrand} title={brandTitle}>
      noob<span className="np-arrow">→</span>topro
    </button>
  );

  return (
    <header className={"np-topnav" + (scrolled ? " is-scrolled" : "")}>
      <div className="np-topnav-inner">
        {Brand}

        {links && links.length > 0 && (
          <nav className="np-topnav-links" aria-label="Sections">
            {links.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </nav>
        )}

        {tabs && tabs.length > 0 && (
          <nav className="np-topnav-tabs" aria-label="Primary">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={"np-tab" + (t.active ? " active" : "")}
                aria-current={t.active ? "page" : undefined}
                onClick={t.onClick}
              >
                {t.icon && <Icon name={t.icon} size={16} />} {t.label}
              </button>
            ))}
          </nav>
        )}

        <div className="np-topnav-actions">
          {user && <NavIdentity user={user} scores={scores} />}
          {showTheme && <ThemeToggle />}
          {signIn && (
            // A11y P2-7: the header sign-in stays REACHABLE at phone widths (it used to
            // `display:none` below 540px, hiding a guest's only header entry point). Below
            // 540px it collapses to an icon-only button (the label span is hidden via CSS);
            // an explicit aria-label keeps its accessible name in that state.
            <button
              className="np-signinbtn np-topnav-signin"
              onClick={signIn.onClick}
              aria-label={signIn.label || "Sign in"}
            >
              <Icon name="login" size={16} /> <span className="np-topnav-signin-label">{signIn.label || "Sign in"}</span>
            </button>
          )}
          {signOut && (
            <button className="np-signinbtn" onClick={signOut.onClick} title={signOut.title || ""}>
              <Icon name="logout" size={16} /> {signOut.label || "Sign out"}
            </button>
          )}
          {cta && (
            <button
              className="np-btn np-primary np-topnav-cta"
              onClick={cta.onClick}
              disabled={cta.disabled}
            >
              {cta.label}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// Compact signed-in identity for the nav (avatar + overall-rank chip). The full
// name/email live behind the avatar's title + the chip's title, so they stay
// available to assistive tech without crowding the nav row.
function NavIdentity({ user, scores }) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || user.email || "You";
  const avatar = meta.avatar_url || meta.picture || null;
  const showAvatar = avatar && !imgFailed;
  return (
    // A11y P2-4: a real aria-label mirrors the title (title alone isn't reliably
    // exposed to AT or on touch). role=group so AT announces it as the identity cluster.
    <div className="np-topnav-id" title={user.email || name} role="group" aria-label={`Signed in as ${name}`}>
      {showAvatar ? (
        <img className="np-avatar np-topnav-avatar" src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
      ) : (
        <div className="np-avatar np-avatarfallback np-topnav-avatar">{String(name).charAt(0).toUpperCase()}</div>
      )}
      <span className="np-topnav-idtext">
        <span className="np-topnav-name">{name}</span>
        {user.email && <span className="np-topnav-email">{user.email}</span>}
      </span>
      {scores && (
        // A11y P2-4: aria-label gives the chip a self-describing accessible name
        // (the bare rank word alone, e.g. "University", doesn't say what it is).
        <span
          className="np-dash-rankchip np-topnav-rank"
          title="Your overall rank"
          aria-label={`Your overall rank: ${rankFor(phdIndex(scores)).name}`}
        >
          {rankFor(phdIndex(scores)).name}
        </span>
      )}
    </div>
  );
}
