import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "AI Transparency Notice",
  description:
    "How noobtopro uses an AI system to read your reasoning and produce feedback and a numeric score — how it works, what the score is and is not, its limitations, and how to request human review and contest a result.",
  alternates: { canonical: "/legal/ai-transparency" },
};

export default function AiTransparencyPage() {
  return (
    <LegalLayout title="AI Transparency Notice">
      <p>
        <strong>You are interacting with an AI system.</strong> {LEGAL.siteName} ({LEGAL.domainBare})
        uses an AI system to read the reasoning in your math, physics, and chemistry work and to help
        generate feedback and a numeric <strong>score (0&ndash;350)</strong>. This notice explains, in
        plain language, how that works and its limitations. It supplements our{" "}
        <a href="/privacy">Privacy Policy</a> and our <a href="/terms">Terms of Service</a>.
      </p>

      <Section heading="1. How noobtopro uses AI">
        <p>
          Your feedback and score are produced with the help of an AI system &mdash;{" "}
          <strong>not a human examiner</strong>. The system uses large language models (LLMs)
          provided by our inference provider, <strong>Groq, Inc.</strong> The grading application,
          the rubric logic, and the final score are built and operated by us.
        </p>
        <p>
          To produce your feedback, the text of your answer and any photo of your handwritten work
          you upload are sent to <strong>Groq</strong> and processed on infrastructure in the{" "}
          <strong>United States</strong>. Your submissions and photos are{" "}
          <strong>not used to train</strong> the model: we rely on Groq&rsquo;s no-training commitment
          and zero-data-retention terms. Please do <strong>not</strong> include unnecessary personal
          or sensitive information in your photos (for example, other people, faces, or identifying
          details) &mdash; see our <a href="/privacy">Privacy Policy</a> for how we handle the data
          you submit.
        </p>
      </Section>

      <Section heading="2. How the score is produced">
        <ol>
          <li>You submit typed answers and/or photos of your work.</li>
          <li>The AI analyses the <strong>reasoning</strong> against a rubric.</li>
          <li>
            <strong>Our servers</strong> compute the final 0&ndash;350 score from that rubric &mdash;
            the model does not set the number directly.
          </li>
        </ol>
        <p>
          The final score is <strong>server-authoritative</strong>: it is calculated by our systems,
          not handed back verbatim by the model. The score is an <strong>absolute achievement
          scale</strong> &mdash; a measure of your own work against the rubric. We do{" "}
          <strong>not</strong> rank you against other users, and there is no comparative leaderboard.
        </p>
      </Section>

      <Section heading="3. What the score is &mdash; and is not">
        <p>
          The score is a <strong>learning signal</strong> intended to help you improve. It is{" "}
          <strong>not</strong>:
        </p>
        <ul>
          <li>an accredited exam, qualification, or certificate;</li>
          <li>
            an admissions, enrollment, scholarship, employment, or eligibility decision (and we do
            not share it with any school or employer);
          </li>
          <li>a ranking of you against other people;</li>
          <li>a guarantee of ability; or</li>
          <li>a substitute for a qualified teacher.</li>
        </ul>
      </Section>

      <Section heading="4. AI can be wrong">
        <p>
          AI output can be inaccurate. The system can misread handwriting, misinterpret reasoning,
          miss a correct alternative method, or simply make mistakes &mdash; especially with unclear
          photos or unusual notation. Treat your score as <strong>informational guidance, not a
          verdict</strong>, and do not make important decisions based solely on a {LEGAL.siteName}{" "}
          score.
        </p>
      </Section>

      <Section heading="5. Human review &mdash; contest a result">
        <p>
          If you think a score is wrong, you can <strong>request human review and contest the
          result</strong> by contacting us at <strong>{LEGAL.contactEmail}</strong>. Tell us why you
          disagree and we will take it into account.
        </p>
      </Section>

      <Section heading="6. Regulatory context (EU AI Act and GDPR)">
        <p>
          <strong>The EU AI Act &ldquo;high-risk&rdquo; education category does not apply to us.</strong>{" "}
          The Act&rsquo;s high-risk &ldquo;education and vocational training&rdquo; category
          (Annex&nbsp;III(3)) is, by its text, limited to AI systems used <strong>by or within
          educational and vocational training institutions</strong> &mdash; for example to decide
          admission, evaluate learning outcomes that steer a course of study, or monitor exams.{" "}
          {LEGAL.siteName} is a standalone, adults-only consumer self-improvement app that operates{" "}
          <strong>outside any educational institution</strong> and produces no accredited or
          institutional outcome. It therefore falls <strong>outside the scope</strong> of
          Annex&nbsp;III(3).
        </p>
        <p>
          <strong>No ranking of users, so the &ldquo;profiling&rdquo; proviso is not engaged.</strong>{" "}
          The score is an <strong>absolute</strong> achievement scale measuring your own work against
          a rubric &mdash; it is <strong>not</strong> a relative ranking of you against other people,
          and there is no comparative leaderboard. Because the system does not profile users, the
          Article&nbsp;6(3) proviso (which keeps profiling of natural persons high-risk) is not
          triggered.
        </p>
        <p>
          <strong>Transparency.</strong> We provide this notice in line with the AI Act&rsquo;s
          Article&nbsp;50 transparency standard <strong>(which applies from 2&nbsp;August&nbsp;2026)</strong>,
          so that it is clear you are interacting with an AI system when you receive feedback and a
          score.
        </p>
        <p>
          <strong>Automated processing (GDPR Article&nbsp;22).</strong> In our assessment, this
          scoring does not produce a legal or similarly significant effect concerning you: it is a
          learning signal, not an exam, credential, admission, or employment decision, and it is not
          shared with any institution. Even so, we voluntarily provide a plain-language explanation of
          how your score is produced, <strong>human review on request</strong>, and the right to{" "}
          <strong>contest a result and submit your own explanation</strong>. For more on how we
          process your submitted answers and photos, see the automated-processing section of our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </Section>

      <Section heading="7. Eligibility">
        <p>The Service, including AI-assisted scoring, is for adults aged 18 and over.</p>
      </Section>

      <Section heading="8. Contact">
        <p>
          Questions about this Notice: <strong>{LEGAL.contactEmail}</strong> &mdash;{" "}
          {LEGAL.businessName}, a German sole proprietorship (Einzelunternehmen), {LEGAL.city},{" "}
          {LEGAL.country}.
        </p>
      </Section>
    </LegalLayout>
  );
}
