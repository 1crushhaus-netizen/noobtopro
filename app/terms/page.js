import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

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
        application (the &quot;Service&quot;), operated by <strong>{LEGAL.operatorName}</strong> as a {LEGAL.businessForm} (&quot;{LEGAL.siteName}&quot;). By
        using the Service you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <p>
        <strong>
          If you are a consumer in the EU/EEA or the UK, nothing in these Terms removes the
          protections of your local mandatory consumer law or your right to bring proceedings in
          the courts of the place where you live
        </strong>{" "}
        — see &ldquo;Governing law and dispute resolution&rdquo; below.
      </p>

      <Section heading="1. Eligibility">
        <p>
          noobtopro is an <strong>adults-only service</strong>. You must be at least{" "}
          <strong>18 years old</strong> to create an account or use the Service. By creating an
          account or using the Service, you represent and warrant that you are 18 years of age or
          older. The Service is not directed to, and we do not knowingly permit use by, anyone under
          18. We may suspend or terminate any account we believe belongs to a person under 18.
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
          price shown at checkout (currently <strong>€9.99/month</strong>). Payments are processed by{" "}
          <strong>{LEGAL.mor}</strong> ({LEGAL.morEntity}), the <strong>seller of record</strong> for
          your transaction (Merchant of Record); {LEGAL.siteName} provides the service. Subscriptions
          renew automatically until canceled. You can cancel at any time and manage billing from
          <em> Dashboard → Manage subscription</em>. Cancellation, renewal, and refunds are governed
          by our <a href="/refunds">Refund &amp; Cancellation Policy</a>, including your{" "}
          <strong>14-day right of withdrawal</strong> (see the{" "}
          <a href="/refunds">Refund &amp; Cancellation Policy</a>).
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
          <strong> {LEGAL.businessName}</strong> or its licensors and is protected by law. You may not
          copy, modify, or distribute it except as permitted.
        </p>
      </Section>

      <Section heading="8. Disclaimers">
        <p>
          To the maximum extent permitted by applicable law, the Service is provided &quot;as
          is&quot; and &quot;as available&quot; without warranties of any kind. We do not warrant that
          grades, ranks, or generated content are accurate, complete, or error-free, or that the
          Service will be uninterrupted. <strong>
            If you are a consumer in the EU/EEA or the UK, this does not exclude or limit any rights
            or guarantees you have under mandatory consumer law
          </strong> (see &quot;Limitation of liability&quot; below).
        </p>
      </Section>

      <Section heading="9. Limitation of liability">
        <p>
          <strong>Never excluded.</strong> Nothing in these Terms excludes or limits our liability
          for: (a) <strong>death or personal injury</strong> caused by our negligence; (b){" "}
          <strong>gross negligence</strong> (grobe Fahrlässigkeit) or{" "}
          <strong>intent / wilful misconduct</strong> (Vorsatz); (c) fraud or fraudulent
          misrepresentation; (d) liability under the German Product Liability Act
          (Produkthaftungsgesetz) or any other liability that cannot be excluded under applicable
          law; and (e) for consumers, your mandatory legal rights and remedies. This reflects, among
          other things, the mandatory limits of <strong>§ 309 No. 7 BGB</strong> and applies
          notwithstanding anything else in these Terms.
        </p>
        <p>
          <strong>Cap (where permitted).</strong> Subject to the paragraph above and to the maximum
          extent permitted, our total aggregate liability will not exceed the greater of (i) the
          amounts you paid us in the 12 months before the event giving rise to the claim, or (ii){" "}
          <strong>EUR 50</strong>.
        </p>
        <p>
          <strong>Excluded losses (where permitted).</strong> Subject to the &quot;Never
          excluded&quot; paragraph, <strong>{LEGAL.businessName}</strong> is not liable for indirect,
          incidental, special, consequential, or punitive damages, or for loss of
          profits/revenue/goodwill — including any decision made in reliance on a rank, grade, or
          generated content.
        </p>
        <p>
          <strong>Consumer carve-out (overrides).</strong> If you are a consumer, the &quot;Cap&quot;
          and &quot;Excluded losses&quot; paragraphs apply only so far as permitted by your local
          mandatory consumer law. We remain responsible for foreseeable loss we cause by breaking
          this contract or by failing to use reasonable care and skill, and we do not exclude any
          liability we may not exclude under the law of your country of residence.
        </p>
      </Section>

      <Section heading="10. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate access if you
          violate these Terms or to protect the Service. You may delete your account as described in
          our <a href="/privacy">Privacy Policy</a>.
        </p>
      </Section>

      <Section heading="11. Governing law and dispute resolution">
        <p>
          These Terms are governed by {LEGAL.governingLaw}, without regard to conflict-of-laws
          rules.
        </p>
        <p>
          <strong>EU/EEA consumers.</strong> This choice of law does <strong>not</strong> deprive
          you of the mandatory consumer protections of your country of residence (Rome I, Art. 6).
          You may bring proceedings against us either in {LEGAL.venueCity} or in the courts of the
          EU/EEA Member State where you live, and <strong>we will bring proceedings against you only
          in the courts of the place where you live</strong> (Brussels Ia Regulation, Arts. 17–19).
        </p>
        <p>
          <strong>UK consumers.</strong> Nothing here removes the mandatory protections of UK
          consumer law (including the Consumer Rights Act 2015). You may bring proceedings in the
          courts of the place where you live.
        </p>
        <p>
          <strong>Everyone else.</strong> The courts of {LEGAL.venueCity} have jurisdiction, without
          prejudice to any mandatory consumer protections of your country of residence.
        </p>
      </Section>

      <Section heading="12. Complaints and consumer dispute resolution">
        <p>
          Please contact us first at <strong>{LEGAL.contactEmail}</strong> — we aim to resolve
          complaints directly and quickly.
        </p>
        <p>
          {LEGAL.siteName} is a small business (fewer than 10 employees). Under the German Consumer
          Dispute Resolution Act (Verbraucherstreitbeilegungsgesetz, VSBG) we are{" "}
          <strong>not obliged to participate</strong> in dispute-resolution proceedings before a
          consumer arbitration board (Verbraucherschlichtungsstelle), and we do not commit to
          participating in such proceedings.
        </p>
        <p>
          Consumers in another EU/EEA country can get free help with a cross-border complaint from
          the European Consumer Centres Network (ECC-Net) via{" "}
          <a href="https://www.eccnet.eu" target="_blank" rel="noopener noreferrer">
            eccnet.eu
          </a>
          .
        </p>
      </Section>

      <Section heading="13. Changes">
        <p>
          For <strong>material changes</strong> we give <strong>reasonable advance notice</strong>{" "}
          (for example by email or in-Service) before they take effect, and we update the version
          and effective date. <strong>You may stop using the Service and cancel before a material
          change takes effect</strong>; if you cancel before the change applies, the change does not
          bind you. We do not treat your mere continued use as acceptance of a material change
          without this advance notice and right to cancel.
        </p>
      </Section>

      <Section heading="14. Contact">
        <p>
          <strong>{LEGAL.businessName}</strong>, operated by {LEGAL.operatorName} ({LEGAL.businessForm}),
          {LEGAL.city}, {LEGAL.country} — <strong>{LEGAL.contactEmail}</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
