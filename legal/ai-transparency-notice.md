# AI Transparency & Limitations Notice — noobtopro

> **DRAFT for counsel — not legal advice.** Published at `/legal/ai-transparency`.
>
> **EU AI Act position (lead argument).** The grader is **not high-risk** because the Annex III(3)
> "education and vocational training" category is, by its text, limited to AI used **by or within
> educational and vocational training institutions**. noobtopro is a standalone, adults-only
> consumer self-improvement app operating **outside any educational institution**, producing no
> accredited/institutional outcome — so it is **out of scope of Annex III(3)** in the first place.
> We do **not** rely on the Art. 6(3)(b) "improves a completed human activity" derogation as the
> primary argument.
>
> **Profiling proviso (Art. 6(3)).** The "profiling of natural persons is always high-risk"
> proviso is **not engaged**: the score is an **absolute** achievement scale measuring the user's
> own work against a rubric — **not** a relative ranking of the person against others. The
> comparative leaderboard / relative-rank-against-others feature has been **removed** from the
> product specifically to avoid the profiling angle. (If any future feature ranks users against
> one another, re-run this assessment.)
>
> **Art. 50 transparency** is the applicable standard and **applies from 2 August 2026**; this
> notice is built to it now. **GDPR Art. 22**: in our assessment no legal or similarly significant
> effect arises (learning signal, not exam/credential/admission/employment, not shared with any
> institution) — but we offer voluntary human review and contest anyway.
>
> **Provider:** Groq, Inc. (US inference). Submissions/photos are processed in the **US** and are
> **not used to train** the model; we rely on Groq's no-training commitment and zero-data-retention
> terms (see `sub-processors.md`).

## How noobtopro uses AI (user-facing — matches the live page)
**You are interacting with an AI system.** noobtopro uses an AI system to read the reasoning in
your math/physics/chemistry work and help generate feedback and a numeric **score (0–350)**. The
underlying LLMs are provided by our inference provider, **Groq, Inc.**; the grading application,
rubric logic, and final score are built and operated by us. **Feedback and scores are produced
with the help of an AI system, not a human examiner.**

To produce your feedback, the text of your answer and any photo of your handwritten work you
upload are sent to **Groq** and processed on infrastructure in the **United States**. Your
submissions and photos are **not used to train** the model (Groq no-training commitment +
zero-data-retention). **Do not include unnecessary personal or sensitive information in your
photos** (e.g. other people, faces, identifying details) — see the [Privacy Policy](/privacy).

**What the score is — and is NOT.** A **learning signal** to help you improve. It is **NOT** an
accredited exam/qualification/certificate; **NOT** an admissions, enrollment, scholarship,
employment, or eligibility decision (and is not shared by us with any school or employer); **NOT a
ranking of you against other people**; **NOT** a guarantee of ability; **NOT** a substitute for a
qualified teacher.

**How the score is produced.** (1) You submit typed answers and/or photos. (2) The AI analyses the
**reasoning** against a rubric. (3) **Our servers** compute the final 0–350 score from that rubric
(the model does not set the number directly). The score is **server-authoritative** and is an
**absolute achievement scale** — we do **not** rank you against other users, and there is no
comparative leaderboard.

**AI can be wrong.** It can misread handwriting, misinterpret reasoning, miss a correct
alternative method, or make mistakes — especially with unclear photos or unusual notation. Treat
your score as **informational guidance, not a verdict.** Do not make important decisions based
solely on a noobtopro score.

**Human review.** If you think a score is wrong, you can **request human review and contest the
result** at **russellrozario@noobto.pro**. Tell us why you disagree and we will take it into
account.

**Your data.** See our [Privacy Policy](/privacy), including the automated-processing section.
**Who this is for:** adults **18 and over**.

---

## ToS AI clauses (drop-in)
**AI disclosure** — feedback and the score are generated with the assistance of an AI system using
a third-party model from Groq, Inc. (US inference); the final score is computed by our servers from
an AI-produced rubric. **Nature** — the score is an absolute educational learning signal, not an
accredited exam/certification/admission/employment/eligibility decision, is not a ranking against
other users, creates no entitlement, and has no legal or official standing. **No warranty of
accuracy** — AI output can be inaccurate; provided "as is" to the maximum extent permitted,
**subject to mandatory consumer rights which cannot be excluded** (EU/UK). **No reliance** — do not
rely on a score as the sole basis for any significant decision. **Human review** — you may request
human review and contest a result at russellrozario@noobto.pro. **Eligibility** — 18+.
**Acceptable use** — do not present a score as an official credential, misrepresent authorship, or
attempt to extract/reverse-engineer the model.

## Privacy Policy — automated-decision paragraph (drop-in)
To provide your score, we use automated processing (including an AI system) to analyse your
submitted answers and photos and generate feedback and a numeric score (0–350). The model is
provided by Groq, Inc. (US); the final score is calculated by our systems. **In our assessment this
scoring does not produce a legal effect concerning you and does not similarly significantly affect
you within the meaning of Article 22 GDPR** (it is an absolute learning signal, not an
exam/credential/admission/employment decision, is not a ranking against other users, is not shared
with any institution, and has no legal consequence), so the Art. 22(1) prohibition does not apply.
**Even so, we voluntarily provide:** a plain-language explanation of how your score is produced,
**human review** on request, and the right to **contest** a result and submit your own explanation
at russellrozario@noobto.pro. Legal basis: [Art. 6(1)(b) contract — confirm].

### Open questions for counsel (NOT for the published page)
- Track any Commission/standardisation clarification of the Annex III(3) "institutions" scope and
  keep the out-of-scope reasoning on file; prepare/retain a non-high-risk assessment if challenged.
- Confirm the Art. 50 transparency application date (2 Aug 2026) and any Digital Omnibus changes on
  OJ publication before relying on the timeline.
- Provider-vs-deployer classification; obtain Groq's GPAI value-chain documentation and confirm the
  no-training / zero-data-retention contractual terms in the DPA.
- Consumer-law limits on the accuracy / no-reliance disclaimers (EU/UK mandatory rights).
- Special-category-data risk in photos; confirm the "no unnecessary personal/sensitive content"
  advisory + transient processing are adequate mitigations.
- Confirm GDPR Art. 6(1)(b) as the legal basis for the automated processing.
- Re-run the high-risk / profiling assessment if any feature is ever added that ranks users against
  one another.
