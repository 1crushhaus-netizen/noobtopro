import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "AI Transparency Notice",
  description:
    "How noobtopro uses an AI system to read your reasoning and produce feedback and a numeric rank — how it works, what the rank is and is not, its limitations, and how to request human review and contest a result.",
  alternates: { canonical: "/legal/ai-transparency" },
};

export default function AiTransparencyPage() {
  return (
    <LegalLayout title="AI Transparency Notice">
      <p>
        <strong>You are interacting with an AI system.</strong> {LEGAL.siteName} ({LEGAL.domainBare})
        uses an AI system to read the reasoning in your math, physics, and chemistry work and to help
        generate feedback and a numeric <strong>rank (0&ndash;350)</strong>. This notice explains, in
        plain language, how that works and its limitations. It supplements our{" "}
        <a href="/privacy">Privacy Policy</a> and our <a href="/terms">Terms of Service</a>.
      </p>

      <Section heading="1. How noobtopro uses AI">
        <p>
          Your feedback and rank are produced with the help of an AI system &mdash;{" "}
          <strong>not a human examiner</strong>. The system uses large language models (LLMs)
          provided by a third-party model provider (such as Groq). The grading application, the
          rubric logic, and the final rank are built and operated by us.
        </p>
      </Section>

      <Section heading="2. How the rank is produced">
        <ol>
          <li>You submit typed answers and/or photos of your work.</li>
          <li>The AI analyses the <strong>reasoning</strong> against a rubric.</li>
          <li>
            <strong>Our servers</strong> compute the final 0&ndash;350 rank from that rubric &mdash;
            the model does not set the number directly.
          </li>
        </ol>
        <p>
          The final rank is <strong>server-authoritative</strong>: it is calculated by our systems,
          not handed back verbatim by the model. The rank is <strong>relative</strong> to a
          reference population, so the same work may map to a different number over time.
        </p>
      </Section>

      <Section heading="3. What the rank is &mdash; and is not">
        <p>
          The rank is a <strong>relative learning signal</strong> intended to help you improve. It is{" "}
          <strong>not</strong>:
        </p>
        <ul>
          <li>an accredited exam, qualification, or certificate;</li>
          <li>
            an admissions, enrollment, scholarship, employment, or eligibility decision (and we do
            not share it with any school or employer);
          </li>
          <li>a guarantee of ability; or</li>
          <li>a substitute for a qualified teacher.</li>
        </ul>
      </Section>

      <Section heading="4. AI can be wrong">
        <p>
          AI output can be inaccurate. The system can misread handwriting, misinterpret reasoning,
          miss a correct alternative method, or simply make mistakes &mdash; especially with unclear
          photos or unusual notation. Treat your rank as <strong>informational guidance, not a
          verdict</strong>, and do not make important decisions based solely on a {LEGAL.siteName}{" "}
          rank.
        </p>
      </Section>

      <Section heading="5. Human review &mdash; contest a result">
        <p>
          If you think a rank is wrong, you can <strong>request human review and contest the
          result</strong> by contacting us at <strong>{LEGAL.contactEmail}</strong>. Tell us why you
          disagree and we will take it into account.
        </p>
      </Section>

      <Section heading="6. Transparency context (EU AI Act)">
        <p>
          We provide this notice to meet the transparency expectations for AI systems &mdash;
          including the Article&nbsp;50 transparency baseline of the EU&nbsp;AI&nbsp;Act &mdash; so it
          is clear that you are interacting with an AI system when you receive feedback and a rank.
        </p>
        <p>
          The ranking is a relative educational learning signal. It does not produce legal effects
          concerning you and does not similarly significantly affect you, and it is not shared with
          any institution. Even so, we voluntarily provide a plain-language explanation of how your
          rank is produced, human review on request, and the right to contest a result and submit
          your own explanation. For more on how we process your submitted answers and photos, see the
          automated-processing section of our <a href="/privacy">Privacy Policy</a>.
        </p>
      </Section>

      <Section heading="7. Eligibility">
        <p>The Service, including AI-assisted ranking, is for adults aged 18 and over.</p>
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
