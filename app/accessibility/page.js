import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Accessibility Statement",
  description:
    "Our commitment to making noobtopro accessible — our WCAG 2.1 Level AA target under the European Accessibility Act, current conformance status, known limitations, and how to report a barrier.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <LegalLayout title="Accessibility Statement">
      <p>
        {LEGAL.businessName} is committed to making our web application accessible to the widest
        possible audience, including people with disabilities. We aim for an experience that is{" "}
        <strong>perceivable, operable, understandable, and robust</strong>. {LEGAL.siteName} is
        operated by {LEGAL.businessName}, a {LEGAL.businessForm}.
      </p>

      <Section heading="1. Conformance status">
        <p>
          We target <strong>WCAG 2.1 Level AA</strong>, as referenced by the European harmonised
          standard <strong>EN&nbsp;301&nbsp;549 (v3.2.1)</strong> under the European Accessibility
          Act (Directive (EU)&nbsp;2019/882). {LEGAL.siteName} is{" "}
          <strong>partially conformant</strong> — some content does not yet fully conform. Known
          exceptions are listed below.
        </p>
      </Section>

      <Section heading="2. Known limitations">
        <p>
          Based on an internal audit conducted on 18&nbsp;June&nbsp;2026, we are aware of the
          following areas that do not yet fully meet our target. Each is in progress:
        </p>
        <ul>
          <li>
            <strong>Public &quot;Learn&quot; pages (light theme).</strong> The Math subject-accent
            &quot;eyebrow&quot; text has a contrast ratio of 3.81:1, below the AA minimum of 4.5:1
            (WCAG 1.4.3).
          </li>
          <li>
            <strong>Public &quot;Learn&quot; pages (light theme).</strong> The Physics
            subject-accent &quot;eyebrow&quot; text has a contrast ratio of 3.98:1, below the AA
            minimum of 4.5:1 (WCAG 1.4.3).
          </li>
          <li>
            <strong>Certain views.</strong> A few views are missing a top-level{" "}
            <code>&lt;h1&gt;</code> heading (WCAG 1.3.1 / 2.4.6).
          </li>
          <li>
            <strong>Some interactive controls.</strong> A few touch targets are approximately 28px,
            below the recommended minimum size (WCAG 2.5.8).
          </li>
          <li>
            <strong>Dynamic status messages.</strong> One live region announces more verbosely than
            necessary (WCAG 4.1.3).
          </li>
        </ul>
        <p>
          We assess the app through automated testing, manual review, and assistive-technology
          testing.
        </p>
      </Section>

      <Section heading="3. Feedback — tell us about a barrier">
        <p>
          If you encounter an accessibility barrier, please tell us. Email{" "}
          <strong>{LEGAL.contactEmail}</strong>. Please describe the problem, the page or screen
          where you found it, and the assistive technology or browser you were using. We aim to
          respond within <strong>five business days</strong>.
        </p>
      </Section>

      <Section heading="4. Enforcement and escalation">
        <ul>
          <li>
            <strong>EU / EEA.</strong> You may contact the market-surveillance or
            service-compliance authority responsible for the European Accessibility Act in our
            Member State of establishment, {LEGAL.country}.
          </li>
          <li>
            <strong>United Kingdom.</strong> You may contact the Equality Advisory and Support
            Service (EASS) regarding the Equality Act 2010.
          </li>
          <li>
            <strong>United States.</strong> Please contact us directly; we are committed to
            effective communication consistent with the ADA.
          </li>
        </ul>
      </Section>

      <Section heading="5. Compatibility and preparation">
        <p>
          Accessibility of {LEGAL.siteName} relies on HTML, CSS, ARIA, and JavaScript, and is
          designed to work with recent browsers and common assistive technologies (such as NVDA and
          VoiceOver). This statement is based on a self-assessment conducted on
          18&nbsp;June&nbsp;2026 and is reviewed at least annually.
        </p>
      </Section>

      <Section heading="6. Contact">
        <p>
          Questions about this statement: <strong>{LEGAL.contactEmail}</strong> —{" "}
          {LEGAL.businessName}, {LEGAL.city}, {LEGAL.country}.
        </p>
      </Section>
    </LegalLayout>
  );
}
