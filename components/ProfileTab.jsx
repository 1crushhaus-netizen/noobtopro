"use client";

import React, { useState } from "react";
import { SUBJECTS, ORDER, band, totalPoints, phdIndex } from "@/lib/scoring";

/**
 * Profile for a signed-in user: identity, diagnostic status (with an empty
 * state if they haven't tested yet), a stats summary, and account actions.
 */
export default function ProfileTab({
  user,
  scores,
  history = [],
  onStartDiagnostic,
  onPractice,
  onSignOut,
  onReset,
  onViewProgress,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = (user && user.user_metadata) || {};
  const name = meta.full_name || meta.name || (user && user.email) || "You";
  const avatar = meta.avatar_url || meta.picture || null;
  const email = user && user.email;
  const completed = Boolean(scores);
  const attempts = (history || []).filter((h) => h.type === "attempt").length;
  const showAvatar = avatar && !imgFailed;

  return (
    <div className="fade-up">
      <div className="np-card np-profilehead">
        {showAvatar ? (
          <img className="np-avatar" src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
        ) : (
          <div className="np-avatar np-avatarfallback">{String(name).charAt(0).toUpperCase()}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="np-profilename">{name}</div>
          {email && <div className="np-profileemail">{email}</div>}
        </div>
        <button className="np-ghost" onClick={onSignOut}>Sign out</button>
      </div>

      {!completed ? (
        <div className="np-card" style={{ textAlign: "center", padding: "36px 24px" }}>
          <h2 className="np-h2">No diagnostic yet</h2>
          <p className="np-lede" style={{ marginBottom: 20 }}>
            Take the three-question diagnostic to get your starting scores in math, physics, and chemistry.
          </p>
          <button className="np-btn np-primary np-big" onClick={onStartDiagnostic}>Begin diagnostic</button>
        </div>
      ) : (
        <>
          <div className="np-stats">
            <div className="np-card np-statcard">
              <span className="np-statlabel">PhD-level intelligence</span>
              <span className="np-statnum" style={{ color: "var(--math)" }}>
                {phdIndex(scores)}<span style={{ color: "var(--muted)", fontSize: 18 }}> / 100</span>
              </span>
              <span className="np-statsub">{band(phdIndex(scores))} overall</span>
            </div>
            <div className="np-card np-statcard">
              <span className="np-statlabel">Total points</span>
              <span className="np-statnum">
                {totalPoints(scores)}<span style={{ color: "var(--muted)", fontSize: 18 }}> / 300</span>
              </span>
              <span className="np-statsub">across all three subjects</span>
            </div>
            <div className="np-card np-statcard">
              <span className="np-statlabel">Problems graded</span>
              <span className="np-statnum">{attempts}</span>
              <span className="np-statsub">practice attempts</span>
            </div>
          </div>

          <div className="np-card">
            <div className="np-charttitle" style={{ marginBottom: 14 }}>By subject</div>
            {ORDER.map((k) => {
              const sc = scores[k]?.score ?? 0;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ color: SUBJECTS[k].color, fontFamily: "var(--mono)", width: 18 }}>{SUBJECTS[k].glyph}</span>
                  <span style={{ width: 92, fontSize: 14 }}>{SUBJECTS[k].label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, width: 64 }}>
                    {sc}<span style={{ color: "var(--muted)" }}>/100</span>
                  </span>
                  <span className="np-bandtag" style={{ color: SUBJECTS[k].color }}>{band(sc)}</span>
                  <button className="np-ghost" style={{ marginLeft: "auto" }} onClick={() => onPractice && onPractice(k)}>
                    practice
                  </button>
                </div>
              );
            })}
          </div>

          <div className="np-feedactions">
            <button className="np-ghost" onClick={onViewProgress}>See progress over time</button>
            <button className="np-ghost" onClick={onReset} style={{ color: "var(--chem)" }}>Reset my progress</button>
          </div>
        </>
      )}
    </div>
  );
}
