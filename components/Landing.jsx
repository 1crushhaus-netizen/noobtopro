"use client";

import React, { useState } from "react";
import Icon from "@/components/Icon";
import TopNav from "@/components/TopNav";
import { useScrollReveal, useScrolled } from "@/components/useReveal";
import { SubjectGlyph } from "@/components/ui";
import { ORDER, SUBJECTS } from "@/lib/scoring";

/* =============================================================================
   Landing: the public marketing page (Polar-style: terse, mechanism-forward,
   noobtopro's own greyscale skin). Rendered as an early return from
   components/Noobtopro.jsx for guests on the intro stage. All CTAs call back
   into the live app handlers passed as props (onProveIt / onSignIn).

   Motion (the "Dynamic" preset, dependency-free):
   - Hero entrance + headline-underline "draw" + glow "breathe" are pure CSS
     animations that run on load (ungated, so they never flash).
   - Everything below the fold reveals on scroll via ONE IntersectionObserver
     that sets a `data-inview` attr on [data-reveal]/[data-revealbar] elements
     (an attribute, not a class, so it survives React re-renders); the hidden
     state is gated behind `.is-armed` (added on mount) so the page is fully
     visible with JS disabled. The 0–350 ranks bar fills left→right on reveal.
   - All of it is transform/opacity only and inherits the global
     prefers-reduced-motion kill-switch in globals.css. Styles: .np-lp-* layer.
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
    "An adaptive placement walks nine graded steps across math, physics, and chemistry, drawn from a curated, standardized bank. Explain each step, or tap “I don’t know” to skip."],
  ["02", "Get ranked",
    "Your reasoning maps to a 0–350 rank per subject, Elementary to Doctorate. One honest pass places you anywhere on the true range."],
  ["03", "Climb",
    "Pick a subject and get problems calibrated to your level. Sound reasoning moves your score, even when the final answer is wrong."],
];

const ENGINE = [
  ["target", "Reasoning-first grading",
    "The grader solves the problem itself, types every flaw, then scores your reasoning path independently of the final answer. A clean arithmetic slip costs almost nothing; a broken inference costs heavily, even when the answer is right."],
  ["grid", "9-axis chain-link rubric",
    "Every answer is scored 0–4 on nine axes and drawn as a radar, so you see exactly where the reasoning holds and where it breaks."],
  ["refresh", "Unified Glicko-2 ranking",
    "Each axis is a difficulty-adjusted rating judged against the question’s level. Beating a hard problem climbs; acing an easy one barely moves you. Score, radar, and leaderboard never disagree."],
  ["shield", "Built to resist gaming",
    "Jargon-salad scores single digits. Farming one topic damps your gains. Scoring is server-authoritative over an HMAC-signed step chain, so you can’t forge a grade or skip a step."],
  ["clip", "Photo-of-work grading",
    "Snap a photo of your handwritten solution. A vision model reads your steps and grades the reasoning, with a graceful text fallback."],
  ["bulb", "Learn, don’t leak",
    "Stuck? It won’t hand you the answer; it asks the right question and teaches the one concept you’re missing, with the proof or derivation behind it."],
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
  {
    cat: "Getting started",
    items: [
      ["Is noobtopro free?",
        "Yes. The diagnostic, your rank, the leaderboard, and the full concept library are free forever, with no credit card. A Pro tier is planned for unlimited graded practice and extras, but everything you need to find your level and start learning is free."],
      ["Do I need an account?",
        "No. The whole flow runs as a guest in your browser. Sign in only to save your rank across devices; your guest progress carries over automatically the first time you do."],
      ["Is it for my level?",
        "Yes, whatever your level. The placement is adaptive: it starts in the middle and steps up or down with each answer, calibrating itself from Elementary all the way to Doctorate, across math, physics, and chemistry."],
      ["How long does the placement take?",
        "About 10 to 15 minutes. It is nine short problems, three each in math, physics, and chemistry, and you can tap “I don’t know” to skip any step you are stuck on."],
    ],
  },
  {
    cat: "How scoring and ranks work",
    items: [
      ["How are my answers evaluated?", (
        <>
          <p>Your reasoning is graded, not whether the final number is right. The pipeline is deterministic and server-authoritative:</p>
          <ol>
            <li><strong>Screen.</strong> Blank, “I don’t know,” off-topic, or gibberish answers are caught by a deterministic check (no model call) and scored 0.</li>
            <li><strong>The grader solves it first.</strong> A fixed model, run at temperature 0 (identical work gives an identical score), works the problem itself: principle, step-by-step solution with units, and a calculator expression the server re-evaluates to verify the arithmetic, before it judges your work.</li>
            <li><strong>It types every flaw.</strong> Comparing your work to its own solution, it labels each error conceptual, strategic, reasoning, execution-slip, or communication, using its own computed numbers to tell a slip from a broken inference.</li>
            <li><strong>It scores nine axes 0–4, path-independently.</strong> A matching final answer can’t raise an axis; a non-matching one can’t lower a sound chain.</li>
            <li><strong>The server computes the score</strong> (the model emits none) as a transparent weighted sum: Principle ×5, Justification ×4, Logic ×4, Strategy ×3, Verification ×3, Comprehension ×2, Method ×2, Computation ×1, Communication ×1. The weights total 25, so it lands on 0–100 and every axis contributes weight × value points. Computation’s weight of 1 means a pure arithmetic slip costs 4 points or less; the conceptual axes (Principle plus Justification = 9) and Logic dominate.</li>
          </ol>
          <p><strong>Anti-gaming:</strong> a name-dropped formula or jargon with no valid derivation scores 0 on Principle, Justification, and Logic; length never raises a score.</p>
          <p><strong>Score to rank:</strong> each axis is a Glicko-2 rating and the question is the rated opponent (its difficulty is its rating on the same 0–350 scale). Your axis ratings update against it, then combine, by the same weights, into your 0–350 subject rank, and difficulty self-calibrates from how everyone performs on each item.</p>
        </>
      ),
        "Your reasoning is graded, not whether the final number is right. The pipeline is deterministic and server-authoritative. Blank, off-topic, or gibberish answers are screened out by a deterministic check and scored 0. A fixed model, run at temperature 0 so identical work earns an identical score, solves the problem itself before judging yours. It types every flaw (conceptual, strategic, reasoning, execution-slip, or communication), then scores nine reasoning axes from 0 to 4, independently of whether your final answer matched. The server computes the score as a transparent weighted sum: Principle 5, Justification 4, Logic 4, Strategy 3, Verification 3, Comprehension 2, Method 2, Computation 1, Communication 1. So a pure arithmetic slip costs very little while a broken inference costs heavily, even when the answer is right. Each axis is then a Glicko-2 rating against the question difficulty, combining into your 0 to 350 subject rank."],
      ["What do the 0–350 scores and ranks mean?",
        "Each subject sits on a 0–350 scale split into five ranks: Elementary (0–69), Middle (70–139), High (140–209), University (210–279), and Doctorate (280–350). The number reflects the hardest reasoning you can do reliably, not how many questions you got right."],
      ["Can a wrong answer score higher than a right one?",
        "Yes. noobtopro grades your reasoning independently of the final number, so a sound method with a small arithmetic slip outscores a correct answer you could not justify, or a lucky guess. The thinking is what is measured."],
      ["Why didn’t my score move much after a good answer?",
        "Because difficulty is calibrated to you. Each problem’s difficulty self-adjusts from how everyone performs on it, so a strong answer on an easy problem is expected and barely moves your rating, while the same quality on a hard problem climbs fast."],
    ],
  },
  {
    cat: "Trust and credibility",
    items: [
      ["Can the scoring be gamed?",
        "It is specifically built to resist it. Impressive-sounding jargon with no real reasoning scores near zero, repeating the same topic damps how much you can gain, and scoring happens on the server over a signed record of each step, so a grade cannot be forged or a step skipped from the browser."],
      ["Can an AI really grade reasoning fairly?",
        "It does most of the grading, and we are candid about what that means. To stay consistent it solves the problem itself first, scores against fixed examples at a fixed setting, and reconciles the score against its own rubric so the number cannot contradict the breakdown you see. It is not infallible, which is why every score comes with a transparent rubric and a worked solution you can check."],
      ["What if I disagree with a grade?",
        "You can see exactly why you got it. Every graded answer shows the per-axis breakdown, what you did well, what would reach full marks, and a worked solution, so a score is always inspectable rather than a black box. Your rank is a tool for growth, not a verdict, and your next answers move it."],
      ["Is the rank trustworthy enough to share?",
        "It is built to be. The rank is relative and self-calibrating, hard to game, and computed server-side, so it is an honest signal of where your STEM reasoning stands. It is not an accredited exam score, and we do not pretend it is."],
    ],
  },
  {
    cat: "Learning and practice",
    items: [
      ["How do I improve my rank?",
        "Practice. Pick a subject and noobtopro serves problems calibrated to your level; sound reasoning raises your score even when the final answer is wrong. The Learn library then teaches the concept behind anything you miss, including the proof or derivation, not just a definition."],
      ["Will it just give me the answer?",
        "No, and that is deliberate. When you are stuck it asks the right next question and teaches the underlying concept instead of handing over the solution. Worked solutions unlock only after a genuine attempt, so it builds understanding rather than letting you copy."],
      ["Is using noobtopro cheating?",
        "It is the opposite of a cheat tool. It grades and teaches your reasoning, will not reveal answers before you try, and rewards understanding over recall. It is built for learning the material, not getting around it."],
      ["Can I submit a photo of my work?",
        "Yes. Snap a photo of your handwritten solution and a vision model reads and grades your steps, with a text fallback if the photo does not come through."],
    ],
  },
  {
    cat: "Account and privacy",
    items: [
      ["How do I sign in?",
        "With Google, in one tap. You can also do everything as a guest first and sign in later; your guest progress migrates into your account automatically the first time you sign in."],
      ["Is my data safe, and do you sell it?",
        "Your data is private, and no, we do not sell it. As a guest, your progress stays in your own browser. Once you sign in, your data is readable only by you, and the leaderboard is fully anonymous, showing the rank distribution and your position but never names or emails. You can reset your progress anytime."],
      ["What devices does it work on?",
        "Any modern browser, on desktop or phone, with nothing to install. Photo grading is especially handy on mobile, where you can shoot your handwritten work directly."],
    ],
  },
];

export default function Landing({
  user,
  busy,
  isPro,
  onProveIt,
  onSignIn,
  onUpgrade,
  error,
  onDismissError,
  showAuthNote,
  onDismissAuthNote,
}) {
  const [openFaq, setOpenFaq] = useState(null);
  // Scroll-reveal + nav-condense, via the shared motion hooks (one source of
  // truth with the signed-in app). The reveal arms after first paint, so the
  // page renders fully visible first (JS-off / crawler safe).
  const { ref: rootRef, armed } = useScrollReveal();
  const scrolled = useScrolled();

  // FAQPage JSON-LD for answer engines (AI Overviews, ChatGPT, Perplexity). Built from
  // the plain-text answers; characters that could break out of <script> are unicode-
  // escaped so it renders as a plain text child (no dangerouslySetInnerHTML needed).
  const faqLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.flatMap((g) => g.items).map(([q, a, schema]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: typeof a === "string" ? a : schema || "" },
    })),
  }).replace(/[<>&]/g, (c) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" }[c]));

  return (
    <div className={"np-lp" + (armed ? " is-armed" : "")} ref={rootRef}>
      <script type="application/ld+json">{faqLd}</script>
      {/* ----------------------------- nav (shared TopNav) ----------------------------- */}
      <TopNav
        scrolled={scrolled}
        brandHref="#top"
        links={[
          { label: "How it works", href: "#how" },
          { label: "The engine", href: "#engine" },
          { label: "Ranks", href: "#ranks" },
          { label: "Pricing", href: "#pricing" },
        ]}
        signIn={!user ? { onClick: onSignIn, label: "Sign in" } : undefined}
        cta={{ label: busy ? "Setting up…" : "Get started", onClick: onProveIt, disabled: busy }}
      />

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
            <span className="np-lp-h1line">Memorize nothing</span>
            <span className="np-lp-h1line"><em>Understand everything</em></span>
          </h1>
          <p className="np-lp-sub">
            Real problems in math, physics, and chemistry, graded on how you reason, not what you
            recall. noobtopro pinpoints your level, then gives you a structured path from where you
            are to Doctorate-level mastery.
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
          <div className="np-lp-head np-lp-head--center" data-reveal>
            <span className="np-lp-eyebrow">How it works</span>
            <h2 className="np-lp-h2">Prove it → Get ranked → Climb</h2>
          </div>
          <div className="np-lp-grid3">
            {STEPS.map(([n, t, d], i) => (
              <div key={n} className="np-card np-lp-feat" data-reveal style={{ "--ri": i }}>
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
          <div className="np-lp-head" data-reveal>
            <span className="np-lp-eyebrow">The engine</span>
            <h2 className="np-lp-h2">Reasoning is the unit of measurement</h2>
            <p className="np-lp-lede">
              Most apps check the final answer. noobtopro models the path you took to get there,
              and that is what it scores, calibrates, and ranks.
            </p>
          </div>
          <div className="np-lp-grid3">
            {ENGINE.map(([ic, t, d], i) => (
              <div key={t} className="np-card np-lp-feat" data-reveal style={{ "--ri": i }}>
                <div className="np-lp-feat-ic"><Icon name={ic} size={18} /></div>
                <div className="np-lp-feat-t">{t}</div>
                <div className="np-lp-feat-d">{d}</div>
              </div>
            ))}
          </div>
          <div className="np-lp-axiswrap">
            <span className="np-lp-eyebrow" data-reveal>The nine reasoning axes</span>
            <div className="np-lp-axes">
              {AXES.map((a, i) => (
                <span key={a} className="np-chip np-lp-axis" data-reveal style={{ "--ri": i }}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- ranks ----------------------------- */}
      <section className="np-lp-section" id="ranks">
        <div className="np-lp-container">
          <div className="np-lp-head np-lp-head--center" data-reveal>
            <span className="np-lp-eyebrow">Ranks</span>
            <h2 className="np-lp-h2">One scale: 0 to 350</h2>
            <p className="np-lp-lede np-lp-lede--center">
              Every subject lives on the same 0–350 scale, split into five curriculum ranks.
              The label is earned per subject, and it never stops moving.
            </p>
          </div>
          <div className="np-lp-scale" aria-hidden="true" data-revealbar>
            {SEG_OPACITY.map((o, i) => (
              <div key={i} className="np-lp-seg" style={{ background: "var(--text)", opacity: o, "--si": i }} />
            ))}
          </div>
          <div className="np-lp-ranks">
            {RANKS.map(([name, range], i) => (
              <div key={name} className="np-lp-rank" data-reveal style={{ "--ri": i }}>
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
          <div className="np-lp-head np-lp-head--center" data-reveal>
            <span className="np-lp-eyebrow">Subjects</span>
            <h2 className="np-lp-h2">Three subjects, same rigor</h2>
          </div>
          <div className="np-lp-grid3">
            {ORDER.map((k, i) => (
              <div key={k} className="np-card np-lp-subj" data-reveal style={{ "--ri": i }}>
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
          <div className="np-lp-head np-lp-head--center" data-reveal>
            <span className="np-lp-eyebrow">Pricing</span>
            <h2 className="np-lp-h2">Free to find your level</h2>
            <p className="np-lp-lede np-lp-lede--center">
              The diagnostic, your rank, and the concept library are free, forever.
              Pro lifts the practice limits when you’re ready to climb fast.
            </p>
          </div>
          <div className="np-lp-price">
            <div className="np-card np-lp-plan" data-reveal style={{ "--ri": 0 }}>
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
            <div className="np-card np-lp-plan np-lp-plan--pro" data-reveal style={{ "--ri": 1 }}>
              <span className="np-lp-badge">Most popular</span>
              <div className="np-lp-plan-name">Pro</div>
              <div className="np-lp-plan-price">$9.99<small> / month</small></div>
              <div className="np-lp-plan-tag">Unlimited practice and the full toolkit.</div>
              <ul className="np-lp-feats">
                {PRO_FEATURES.map((f) => (
                  <li key={f}><Check />{f}</li>
                ))}
              </ul>
              {isPro ? (
                <button className="np-signinbtn np-lp-plan-cta" disabled>
                  You're Pro ✓
                </button>
              ) : (
                <button className="np-btn np-primary np-lp-plan-cta" onClick={onUpgrade || onSignIn} disabled={busy}>
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ faq ------------------------------ */}
      <section className="np-lp-section np-lp-section--alt">
        <div className="np-lp-container">
          <div className="np-lp-head np-lp-head--center" data-reveal>
            <span className="np-lp-eyebrow">FAQ</span>
            <h2 className="np-lp-h2">Questions, answered</h2>
          </div>
          <div className="np-lp-faq">
            {FAQ.map((group, gi) => (
              <div key={group.cat} className="np-lp-faqgroup" data-reveal>
                <div className="np-lp-faqcat">{group.cat}</div>
                {group.items.map(([q, a], ii) => {
                  const id = `${gi}-${ii}`;
                  const open = openFaq === id;
                  const qid = `np-faq-q-${id}`;
                  const aid = `np-faq-a-${id}`;
                  return (
                    <div key={q} className={"np-lp-faq-item" + (open ? " open" : "")}>
                      <button
                        id={qid}
                        className="np-lp-faq-q"
                        aria-expanded={open}
                        aria-controls={aid}
                        onClick={() => setOpenFaq(open ? null : id)}
                      >
                        <span>{q}</span>
                        <Icon name="chevron" size={18} />
                      </button>
                      {open && (
                        <div id={aid} role="region" aria-labelledby={qid} className="np-lp-faq-a">{a}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="np-lp-faq-more" data-reveal>
            <p>Still have questions? The fastest answer is to try it.</p>
            <button className="np-btn np-primary" onClick={onProveIt} disabled={busy}>
              {busy ? "Setting up…" : "Try it"} {!busy && <Icon name="arrow" size={18} />}
            </button>
          </div>
        </div>
      </section>

      {/* --------------------------- closing cta -------------------------- */}
      <section className="np-lp-cta">
        <div className="np-lp-container">
          <h2 className="np-lp-h2" data-reveal style={{ "--ri": 0 }}>Find out where you actually stand.</h2>
          <p className="np-lp-lede np-lp-lede--center" data-reveal style={{ "--ri": 1 }}>
            Nine problems. No memorizing. Just your reasoning, measured.
          </p>
          <button className="np-btn np-primary np-big" onClick={onProveIt} disabled={busy} data-reveal style={{ "--ri": 2 }}>
            {busy ? "Setting up your problems…" : "Get my rank"} {!busy && <Icon name="arrow" size={18} />}
          </button>
        </div>
      </section>

      {/* ----------------------------- footer ----------------------------- */}
      <footer className="np-lp-foot">
        <div className="np-lp-footinner">
          <a className="np-brand np-topnav-brand" href="#top">
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
