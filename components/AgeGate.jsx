"use client";

import React, { useState } from "react";
import Icon from "@/components/Icon";

// A neutral, one-time age screen shown right after sign-up (account creation), before the
// signed-in app is usable. noobtopro is an adults-only service: a user must self-declare a
// date of birth of MIN_AGE or older to continue. Anyone below MIN_AGE is blocked and signed
// out; at/above it, the acknowledgement is recorded on the account so it's never asked again.
// Guests (local-only data) are not gated — this fires only once a real account exists.
const MIN_AGE = 18;

function ageFromISO(iso) {
  if (!iso) return null;
  const dob = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

const wrap = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

export default function AgeGate({ onConfirm, onUnderage }) {
  const [dob, setDob] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const age = ageFromISO(dob);
    if (age == null || age < 0 || age > 120) {
      setErr("Please enter a valid date of birth.");
      return;
    }
    if (age < MIN_AGE) {
      setBlocked(true);
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm?.({ birthYear: new Date(dob + "T00:00:00Z").getUTCFullYear() });
      // On success the parent records the ack and unmounts this gate.
    } catch (e2) {
      setErr((e2 && e2.message) || "Couldn't save that. Please try again.");
      setSubmitting(false);
    }
  }

  if (blocked) {
    return (
      <div style={wrap}>
        <div className="np-surface-elevated np-modal" role="dialog" aria-modal="true" aria-labelledby="np-age-blk-title">
          <div className="np-modal-spark" aria-hidden="true"><Icon name="lock" size={22} /></div>
          <h2 id="np-age-blk-title" className="np-h2" style={{ textAlign: "center", margin: "0 0 8px" }}>
            For ages {MIN_AGE} and over
          </h2>
          <p className="np-lede" style={{ textAlign: "center", margin: "0 auto 22px" }}>
            noobtopro is an adults-only service for ages {MIN_AGE} and over. Please come back
            once you&rsquo;re {MIN_AGE}.
          </p>
          <button className="np-btn np-secondary np-btn--block" onClick={() => onUnderage?.()}>
            <Icon name="login" size={16} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <form className="np-surface-elevated np-modal" onSubmit={submit} aria-labelledby="np-age-title">
        <div className="np-modal-spark" aria-hidden="true"><Icon name="spark" size={22} /></div>
        <h2 id="np-age-title" className="np-h2" style={{ textAlign: "center", margin: "0 0 8px" }}>
          One quick thing
        </h2>
        <p className="np-lede" style={{ textAlign: "center", margin: "0 auto 20px" }}>
          Enter your date of birth to continue. We use this only to confirm your age.
        </p>
        <label htmlFor="np-age-dob" className="np-eyebrow np-eyebrow--xs" style={{ display: "block", marginBottom: 6 }}>
          Date of birth
        </label>
        <input
          id="np-age-dob"
          type="date"
          max={today}
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          required
          className="np-input"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line-strong)", background: "var(--bg)", color: "var(--text)", fontSize: 16 }}
        />
        {err && (
          <p role="alert" style={{ color: "var(--danger)", fontSize: 13.5, margin: "10px 0 0" }}>{err}</p>
        )}
        <button type="submit" className="np-btn np-primary np-btn--block" style={{ marginTop: 18 }} disabled={submitting || !dob}>
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
