import LegalLayout, { Section } from "@/components/LegalLayout";

export const metadata = {
  title: "Terms of Service", // root template appends " — noobtopro" (SEO P2-2)
  description:
    "The terms governing your use of noobtopro: eligibility, accounts, acceptable use, Pro subscriptions, disclaimers, and the limits of an AI-graded skill rank.",
  // Self-referencing canonical (see app/privacy/page.js) — avoids inheriting the
  // root layout's `canonical: "/"`.
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of the noobtopro website and
        application (the &quot;Service&quot;), operated by <strong>[Company Legal Name]</strong>. By
        using the Service you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <Section heading="1. Eligibility">
        <p>
          You must be at least <strong>13 years old</strong> to use the Service. If you are under the
          age of digital consent in your jurisdiction, you may use the Service only with the consent
          and supervision of a parent or guardian, who agrees to these Terms on your behalf.
        </p>
      </Section>

      <Section heading="2. The Service">
        <p>
          noobtopro is an educational tool that grades the reasoning in your math, physics, and
          chemistry work and estimates a relative skill rank. The rank is a self-calibrating learning
          signal, <strong>not an accredited exam score, certification, or professional assessment</strong>,
          and should not be relied upon as such. AI-assisted grading is not infallible.
        </p>
      </Section>

      <Section heading="3. Accounts">
        <p>
          You may use the Service as a guest or sign in with Google. You are responsible for activity
          under your account and for keeping your sign-in secure. You must provide accurate
          information, including your age where requested.
        </p>
      </Section>

      <Section heading="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>attempt to game, manipulate, or reverse-engineer the scoring or ranking system;</li>
          <li>probe, scrape, overload, or disrupt the Service or its infrastructure;</li>
          <li>submit content that is unlawful, abusive, or infringing;</li>
          <li>attempt to extract another user&apos;s data or circumvent access controls;</li>
          <li>use automated means to access the Service except as expressly permitted.</li>
        </ul>
      </Section>

      <Section heading="5. Pro subscription and billing">
        <p>
          The Service offers a paid &quot;Pro&quot; tier billed on a recurring monthly basis at the
          price shown at checkout (currently <strong>€9.99/month</strong>). Payments are processed by
          our payment provider, <strong>Polar</strong>, acting as Merchant of Record. Subscriptions
          renew automatically until canceled. You can cancel at any time and manage billing from
          <em> Dashboard → Manage subscription</em>. Cancellation, renewal, and refunds are governed
          by our <a href="/refunds">Refund &amp; Cancellation Policy</a>.
        </p>
      </Section>

      <Section heading="6. Your content">
        <p>
          You retain ownership of the answers and work you submit. You grant us a limited license to
          process that content as needed to operate the Service (for example, sending it to our AI
          grading provider to produce a grade, and storing your progress).
        </p>
      </Section>

      <Section heading="7. Intellectual property">
        <p>
          The Service, including its content, curriculum, design, and software, is owned by
          <strong> [Company Legal Name]</strong> or its licensors and is protected by law. You may not
          copy, modify, or distribute it except as permitted.
        </p>
      </Section>

      <Section heading="8. Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of
          any kind, to the maximum extent permitted by law. We do not warrant that grades, ranks, or
          generated content are accurate, complete, or error-free, or that the Service will be
          uninterrupted.
        </p>
      </Section>

      <Section heading="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, <strong>[Company Legal Name]</strong> will not be
          liable for any indirect, incidental, special, consequential, or punitive damages, or for
          any loss of data, arising from your use of the Service. Nothing in these Terms limits
          liability that cannot be limited under applicable law.
        </p>
      </Section>

      <Section heading="10. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate access if you
          violate these Terms or to protect the Service. You may delete your account as described in
          our <a href="/privacy">Privacy Policy</a>.
        </p>
      </Section>

      <Section heading="11. Governing law">
        <p>
          These Terms are governed by the laws of <strong>[Jurisdiction]</strong>, without regard to
          conflict-of-laws rules. Mandatory consumer protections in your country of residence still
          apply.
        </p>
      </Section>

      <Section heading="12. Changes">
        <p>
          We may update these Terms from time to time. Material changes will be notified, and your
          continued use after the effective date constitutes acceptance.
        </p>
      </Section>

      <Section heading="13. Contact">
        <p>
          <strong>[Company Legal Name]</strong>, <strong>[Registered Address]</strong> —
          <strong> [support@your-domain]</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
