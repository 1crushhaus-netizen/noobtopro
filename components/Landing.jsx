"use client";

import React, { useState } from "react";
import Icon from "@/components/Icon";
import ThemeToggle from "@/components/ThemeToggle";
import { SubjectGlyph } from "@/components/ui";
import { ORDER, SUBJECTS } from "@/lib/scoring";

/* =============================================================================
   Landing — the public marketing page (Polar-style: terse, mechanism-forward,
   noobtopro's own greyscale skin). Rendered as an early return from
   components/Noobtopro.jsx for guests on the intro stage (stage === "intro" &&
   !chrome). All CTAs call back into the live app handlers passed as props:
     - onProveIt  → beginDiagnostic (starts the adaptive placement)
     - onSignIn   → openSignIn / the not-configured note
   so clicking through transitions the host state machine out of "intro" and
   this page stops rendering. Styles live in the .np-lp-* layer in globals.css.
   ========================================================================== */

// A small check glyph for the pricing rows (Icon.jsx has no "check").
function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const STEPS = [
  ["01", "Prove it",
    "An adaptive placement walks nine graded steps across math, physics, and chemistry, drawn from a curated, standardized bank. Explain each step — or tap “I don’t know” to skip."],
  ["02", "Get ranked",
    "Your reasoning maps to a 0–350 rank per subject, Elementary to Doctorate. One honest pass places you anywhere on the true range."],
  ["03", "Climb",
    "Pick a subject and get problems calibrated to your level. Sound reasoning moves your score — even when the final answer is wrong."],
];

const ENGINE = [
  ["target", "Reasoning-first grading",
    "The grader solves the problem itself, types every flaw, then scores your reasoning path independently of the final answer. A clean arithmetic slip costs almost nothing; a broken inference costs heavily — even when the answer is right."],
  ["grid", "9-axis chain-link rubric",
    "Every answer is scored 0–4 on nine axes and drawn as a radar, so you see exactly where the reasoning holds and where it breaks."],
  ["refresh", "Unified Glicko-2 ranking",
    "Each axis is a difficulty-adjusted rating judged against the question’s level. Beating a hard problem climbs; acing an easy one barely moves you. Score, radar, and leaderboard never disagree."],
  ["shield", "Built to resist gaming",
    "Jargon-salad scores single digits. Farming one topic damps your gains. Scoring is server-authoritative over an HMAC-signed step chain — you can’t forge a grade or skip a step."],
  ["clip", "Photo-of-work grading",
    "Snap a photo of your handwritten solution. A vision model reads your steps and grades the reasoning, with a graceful text fallback."],
  ["bulb", "Learn, don’t leak",
    "Stuck? It won’t hand you the answer — it asks the right question and teaches the one concept you’re missing, with the proof or derivation behind it."],
];

const AXES = [
  "Comprehension", "Principle", "Justification", "Strategy", "Logic",
  "Method", "Computation", "Verification", "Communication",
];

const RANKS = [
  ["Elementary", "0–69"],
  ["Middle", "70–139"],
  ["High", "140–209"],
  ["University", "210–279"],
  ["Doctorate", "280–350"],
];
const SEG_OPACITY = [0.16, 0.32, 0.52, 0.74, 1];

const SUBJECT_BLURB = {
  math: "Arithmetic and algebra through calculus and proof.",
  physics: "Mechanics through modern physics, reasoned from first principles.",
  chemistry: "Stoichiometry through mechanisms and equilibrium.",
};

const FREE_FEATURES = [
  "Full adaptive diagnostic + your 0–350 rank",
  "Anonymous leaderboard placement",
  "Every curated concept guide",
  "~5 graded practice problems / day",
  "Reasoning radar + typed feedback",
];
const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited graded practice",
  "Photo-of-work grading",
  "Full worked solutions + “how to reach 100”",
  "Progress trends + answer history",
  "Data export",
];

const FAQ = [
  ["Does a wrong answer really score higher?",
    "Yes. Sound reasoning on the right method beats a lucky number with none — the grader scores the path, not just the destination. The final answer is graded separately and weighted lightly."],
  ["Do I need an account?",
    "No. The whole flow runs as a guest in your browser. Sign in to keep your rank across devices — your guest progress carries over automatically on first sign-in."],
  ["How is my rank calculated?",
    "Nine per-axis Glicko-2 ratings per subject, each judged against the problem’s difficulty, aggregated into a single 0–350 score. Difficulty self-calibrates from how the whole population performs on each item."],
  ["Which subjects are covered?",
    "Mathematics, physics, and chemistry today — each spanning Elementary through Doctorate level."],
  ["Can I trust the rank?",
    "It’s built to be. Server-authoritative scoring, a signed diagnostic chain, and anti-farm damping make the number hard to game — and meaningful to share."],
];

export default function Landing({
  user,
  busy,
  onProveIt,
  onSignIn,
  error,
  onDismissError,
  showAuthNote,
  onDismissAuthNote,
}) {
  const [openFaq, setOpenFaq] = useState(-1);

  return (
    <div className="np-lp">
      {/* ----------------------------- nav ----------------------------- */}
      <header className="np-lp-nav">
        <div className="np-lp-navinner">
          <a className="np-brand np-lp-brand" href="#top">
            noob<span className="np-arrow">→</span>topro
          </a>
          <nav className="np-lp-navlinks" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#engine">The engine</a>
            <a href="#ranks">Ranks</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="np-lp-navactions">
            <ThemeToggle />
            {!user && (
              <button className="np-signinbtn np-lp-navsignin" onClick={onSignIn}>
                <Icon name="login" size={16} /> Sign in
              </button>
            )}
            <button className="np-btn np-primary np-lp-navcta" onClick={onProveIt} disabled={busy}>
              {busy ? "Setting up…" : "Get started"}
            </button>
          </div>
        </div>
      </header>

      {(error || showAuthNote) && (
        <div className="np-lp-container np-lp-banners">
          {error && (
            <div className="np-error fade-up" role="alert">
              <span>{error}</span>
              <button className="np-ghost" onClick={onDismissError}><Icon name="x" size={14} /> dismiss</button>
            </div>
          )}
          {showAuthNote && (
            <div className="np-banner fade-up">
              <span>Sign-in runs through Supabase. The app works fully as a guest in the meantime.</span>
              <button className="np-ghost" onClick={onDismissAuthNote}><Icon name="x" size={14} /> dismiss</button>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------- hero ----------------------------- */}
      <section className="np-lp-hero" id="top">
        <div className="np-lp-glow" aria-hidden="true" />
        <div className="np-lp-container">
          <span className="np-lp-eyebrow">Reasoning-first STEM assessment</span>
          <h1 className="np-lp-h1">
            It grades <em>how you reason</em><br />— not whether you guessed right.
          </h1>
          <p className="np-lp-sub">
            Real problems in math, physics, and chemistry. noobtopro reads your reasoning on a
            9-axis rubric and ranks each subject 0–350 — Elementary to Doctorate. A wrong answer
            with sound reasoning beats a lucky guess.
          </p>
          <div className="np-lp-herocta">
            <button className="np-btn np-primary np-big" onClick={onProveIt} disabled={busy}>
              {busy ? "Setting up your problems…" : "Prove it"} {!busy && <Icon name="arrow" size={18} />}
            </button>
            <a className="np-ghost np-lp-secondary" href="#how">See how it works</a>
          </div>
          <div className="np-lp-herometa">
            <span>math · physics · chemistry</span>
            <span className="np-lp-dot">·</span>
            <span>0–350 per subject</span>
            <span className="np-lp-dot">·</span>
            <span>5 ranks</span>
            <span className="np-lp-dot">·</span>
            <span>no account needed</span>
          </div>
        </div>
      </section>

      {/* ------------------------- how it works ------------------------- */}
      <section className="np-lp-section" id="how">
        <div className="np-lp-container">
          <div className="np-lp-head np-lp-head--center">
            <span className="np-lp-eyebrow">How it works</span>
            <h2 className="np-lp-h2">Prove it. Get ranked. Climb.</h2>
          </div>
          <div className="np-lp-grid3">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="np-card np-lp-feat">
                <div className="np-lp-step-n">{n}</div>
                <div className="np-lp-feat-t">{t}</div>
                <div className="np-lp-feat-d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- the engine -------------------------- */}
      <section className="np-lp-section np-lp-section--alt" id="engine">
        <div className="np-lp-container">
          <div className="np-lp-head">
            <span className="np-lp-eyebrow">The engine</span>
            <h2 className="np-lp-h2">Reasoning is the unit of measurement.</h2>
            <p className="np-lp-lede">
              Most apps check the final answer. noobtopro models the path you took to get there —
              and that is what it scores, calibrates, and ranks.
            </p>
          </div>
          <div className="np-lp-grid3">
            {ENGINE.map(([ic, t, d]) => (
              <div key={t} className="np-card np-lp-feat">
                <div className="np-lp-feat-ic"><Icon name={ic} size={18} /></div>
                <div className="np-lp-feat-t">{t}</div>
                <div className="np-lp-feat-d">{d}</div>
              </div>
            ))}
          </div>
          <div className="np-lp-axiswrap">
            <span className="np-lp-eyebrow">The nine reasoning axes</span>
            <div className="np-lp-axes">
              {AXES.map((a) => <span key={a} className="np-chip np-lp-axis">{a}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- ranks ----------------------------- */}
      <section className="np-lp-section" id="ranks">
        <div className="np-lp-container">
          <div className="np-lp-head np-lp-head--center">
            <span className="np-lp-eyebrow">Ranks</span>
            <h2 className="np-lp-h2">One scale, 0 to 350.</h2>
            <p className="np-lp-lede np-lp-lede--center">
              Every subject lives on the same 0–350 scale, split into five curriculum ranks.
              The label is earned per subject — and it never stops moving.
            </p>
          </div>
          <div className="np-lp-scale" aria-hidden="true">
            {SEG_OPACITY.map((o, i) => (
              <div key={i} className="np-lp-seg" style={{ background: "var(--text)", opacity: o }} />
            ))}
          </div>
          <div className="np-lp-ranks">
            {RANKS.map(([name, range]) => (
              <div key={name} className="np-lp-rank">
                <div className="np-lp-rank-name">{name}</div>
                <div className="np-lp-rank-range">{range}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- subjects --------------------------- */}
      <section className="np-lp-section np-lp-section--alt">
        <div className="np-lp-container">
          <div className="np-lp-head np-lp-head--center">
            <span className="np-lp-eyebrow">Subjects</span>
            <h2 className="np-lp-h2">Three subjects. Same rigor.</h2>
          </div>
          <div className="np-lp-grid3">
            {ORDER.map((k) => (
              <div key={k} className="np-card np-lp-subj">
                <div className="np-lp-subj-head">
                  <SubjectGlyph subject={k} size={24} />
                  <span className="np-lp-subj-name">{SUBJECTS[k].label}</span>
                </div>
                <div className="np-lp-feat-d">{SUBJECT_BLURB[k]}</div>
                <div className="np-lp-subj-foot">Elementary → Doctorate</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- pricing ---------------------------- */}
      <section className="np-lp-section" id="pricing">
        <div className="np-lp-container">
          <div className="np-lp-head np-lp-head--center">
            <span className="np-lp-eyebrow">Pricing</span>
            <h2 className="np-lp-h2">Free to find your level.</h2>
            <p className="np-lp-lede np-lp-lede--center">
              The diagnostic, your rank, and the concept library are free, forever.
              Pro lifts the practice limits when you’re ready to climb fast.
            </p>
          </div>
          <div className="np-lp-price">
            <div className="np-card np-lp-plan">
              <div className="np-lp-plan-name">Free</div>
              <div className="np-lp-plan-price">$0<small> / forever</small></div>
              <div className="np-lp-plan-tag">Everything you need to find where you stand.</div>
              <ul className="np-lp-feats">
                {FREE_FEATURES.map((f) => (
                  <li key={f}><Check />{f}</li>
                ))}
              </ul>
              <button className="np-btn np-primary np-lp-plan-cta" onClick={onProveIt} disabled={busy}>
                {busy ? "Setting up…" : "Start free"}
              </button>
            </div>
            <div className="np-card np-lp-plan np-lp-plan--pro">
              <span className="np-lp-badge">Soon</span>
              <div className="np-lp-plan-name">Pro</div>
              <div className="np-lp-plan-price">Coming soon</div>
              <div className="np-lp-plan-tag">Unlimited practice and the full toolkit.</div>
              <ul className="np-lp-feats">
                {PRO_FEATURES.map((f) => (
                  <li key={f}><Check />{f}</li>
                ))}
              </ul>
              <button className="np-signinbtn np-lp-plan-cta" onClick={onSignIn}>
                Join the waitlist
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ faq ------------------------------ */}
      <section className="np-lp-section np-lp-section--alt">
        <div className="np-lp-container">
          <div className="np-lp-head np-lp-head--center">
            <span className="np-lp-eyebrow">FAQ</span>
            <h2 className="np-lp-h2">The short version.</h2>
          </div>
          <div className="np-lp-faq">
            {FAQ.map(([q, a], i) => {
              const open = openFaq === i;
              return (
                <div key={q} className={"np-lp-faq-item" + (open ? " open" : "")}>
                  <button
                    className="np-lp-faq-q"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? -1 : i)}
                  >
                    <span>{q}</span>
                    <Icon name="chevron" size={18} />
                  </button>
                  {open && <div className="np-lp-faq-a">{a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --------------------------- closing cta -------------------------- */}
      <section className="np-lp-cta">
        <div className="np-lp-container">
          <h2 className="np-lp-h2">Find out where you actually stand.</h2>
          <p className="np-lp-lede np-lp-lede--center">
            Nine problems. No memorizing. Just your reasoning, measured.
          </p>
          <button className="np-btn np-primary np-big" onClick={onProveIt} disabled={busy}>
            {busy ? "Setting up your problems…" : "Get my rank"} {!busy && <Icon name="arrow" size={18} />}
          </button>
        </div>
      </section>

      {/* ----------------------------- footer ----------------------------- */}
      <footer className="np-lp-foot">
        <div className="np-lp-footinner">
          <a className="np-brand np-lp-brand" href="#top">
            noob<span className="np-arrow">→</span>topro
          </a>
          <span className="np-lp-foot-tag">Prove what you know. Climb from noob to pro.</span>
          <span className="np-lp-foot-tech">Next.js · Supabase · Groq</span>
          <span className="np-lp-foot-copy">© {new Date().getFullYear()} noobtopro</span>
        </div>
      </footer>
    </div>
  );
}
