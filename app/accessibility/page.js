import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Accessibility Statement",
  description:
    "Our voluntary commitment to making noobtopro accessible — our WCAG 2.1 Level AA target, current conformance status, known limitations, and how to report a barrier. We are a micro-enterprise exempt from the European Accessibility Act.",
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

      <Section heading="1. Scope of this statement (voluntary)">
        <p>
          {LEGAL.businessName} is a <strong>micro-enterprise</strong> — a single-person business
          with fewer than 10 staff and an annual turnover and balance sheet that do not exceed
          €2&nbsp;million (Directive (EU)&nbsp;2019/882, Art.&nbsp;3(23)). As a micro-enterprise
          providing a service, we are <strong>exempt</strong> from the accessibility obligations of
          the European Accessibility Act and its German implementation, the Barrierefreiheits&shy;stärkungsgesetz
          (BFSG), <strong>including the duty to publish an accessibility statement</strong>
          {" "}(EAA Art.&nbsp;4(5)). We provide this statement and pursue WCAG conformance{" "}
          <strong>voluntarily</strong>, as a matter of good practice and not as a binding legal
          obligation.
        </p>
      </Section>

      <Section heading="2. Conformance status">
        <p>
          On a voluntary basis we target <strong>WCAG 2.1 Level AA</strong>, as referenced by the
          European harmonised standard <strong>EN&nbsp;301&nbsp;549 (v3.2.1)</strong> (the standard
          used under the European Accessibility Act, Directive (EU)&nbsp;2019/882). {LEGAL.siteName}{" "}
          is currently <strong>partially conformant</strong> — some content does not yet fully
          conform. Known exceptions are listed below.
        </p>
      </Section>

      <Section heading="3. Known limitations">
        <p>
          Based on an internal audit conducted on 18&nbsp;June&nbsp;2026, we are aware of the
          following areas that do not yet fully meet our voluntary target. Each is in progress:
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
        <p>
          <strong>Remediation.</strong> These known issues are being actively worked on. We are
          prioritising the two colour-contrast failures and the missing top-level headings, followed
          by the touch-target and live-region items, and we update this statement as fixes ship.
        </p>
      </Section>

      <Section heading="4. Feedback — tell us about a barrier">
        <p>
          If you encounter an accessibility barrier, please tell us. Email{" "}
          <strong>{LEGAL.contactEmail}</strong>. Please describe the problem, the page or screen
          where you found it, and the assistive technology or browser you were using. We aim to
          respond within <strong>five business days</strong>.
        </p>
      </Section>

      <Section heading="5. Escalation (informational)">
        <p>
          Because we rely on the micro-enterprise exemption (Section&nbsp;1), the formal European
          Accessibility Act enforcement and complaints mechanisms do not apply to us. We list the
          following for information only; in the first instance, please contact us directly so we can
          help.
        </p>
        <ul>
          <li>
            <strong>EU / EEA.</strong> In {LEGAL.country}, the service-side authority responsible
            for the BFSG is the Marktüberwachungsstelle der Länder für die Barrierefreiheit von
            Produkten und Dienstleistungen (MLBF), based in Magdeburg.
          </li>
          <li>
            <strong>United Kingdom.</strong> You may contact the Equality Advisory and Support
            Service (EASS) regarding the Equality Act 2010.
          </li>
          <li>
            <strong>United States.</strong> As a foreign online service we are not subject to a
            statutory ADA duty here; as a matter of good practice we aim for WCAG 2.1 AA as our
            working benchmark and are committed to effective communication. Please contact us
            directly.
          </li>
        </ul>
      </Section>

      <Section heading="6. Compatibility and preparation">
        <p>
          Accessibility of {LEGAL.siteName} relies on HTML, CSS, ARIA, and JavaScript, and is
          designed to work with recent browsers and common assistive technologies (such as NVDA and
          VoiceOver). This statement is based on a self-assessment conducted on
          18&nbsp;June&nbsp;2026 and is reviewed at least annually.
        </p>
      </Section>

      <Section heading="7. Contact">
        <p>
          Questions about this statement: <strong>{LEGAL.contactEmail}</strong> —{" "}
          {LEGAL.businessName}, {LEGAL.city}, {LEGAL.country}.
        </p>
      </Section>
    </LegalLayout>
  );
}
