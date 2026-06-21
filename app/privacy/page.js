import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy", // root template appends " — noobtopro" (SEO P2-2)
  description:
    "How noobtopro collects, uses, shares, and protects your data — covering accounts, learning content, progress, billing, analytics, AI processing, transfers, and your privacy rights.",
  // Self-referencing canonical: without this the page inherits the root layout's
  // `canonical: "/"`, which made the sitemap-listed /privacy declare the homepage as
  // its canonical ("non-canonical page in sitemap" audit warning).
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      note={
        <>
          This is a good-faith, plain-language privacy notice. It has not been reviewed by
          qualified legal counsel; review is recommended before you rely on it. Entity details
          shown as [bracketed] are completed once registration is finalized.
        </>
      }
    >
      <p>
        This Privacy Policy explains how <strong>{LEGAL.businessName}</strong>, operated by{" "}
        {LEGAL.operatorName} (a {LEGAL.businessForm}) (&quot;noobtopro&quot;,
        &quot;we&quot;, &quot;us&quot;) collects, uses, shares, and protects information when you use
        the noobtopro website and application (the &quot;Service&quot;). It is provided under
        Articles&nbsp;12–14 of the EU General Data Protection Regulation (&quot;GDPR&quot;) and
        equivalent laws (UK GDPR; US state privacy laws). <strong>This is a privacy notice, not a
        contract</strong> — the contract that governs your use of the Service is our{" "}
        <a href="/terms">Terms of Service</a>.
      </p>

      <Section heading="1. Who is responsible for your data (controller)">
        <p>
          The controller of your personal data is <strong>{LEGAL.businessName}</strong>, operated by{" "}
          {LEGAL.operatorName} ({LEGAL.businessForm}), based in {LEGAL.city}, {LEGAL.region},{" "}
          {LEGAL.country} ({LEGAL.address}). You can reach us at <strong>{LEGAL.contactEmail}</strong>.
        </p>
        <p>
          <strong>Data Protection Officer.</strong> We are <strong>not required to appoint a Data
          Protection Officer</strong> — our processing does not meet the thresholds in §38 of the
          German Federal Data Protection Act (BDSG) or GDPR Art.&nbsp;37. For any privacy question,
          contact us at <strong>{LEGAL.contactEmail}</strong>.
        </p>
        <p>
          <strong>EU/EEA establishment &amp; lead authority.</strong> Our establishment is in{" "}
          {LEGAL.country}, where decisions about the purposes and means of processing are made. Our
          lead supervisory authority is the {LEGAL.supervisoryAuthority}.
        </p>
        <p>
          <strong>Representatives (GDPR Art.&nbsp;27).</strong> Because we are established in the EU,
          we are <strong>not required to appoint an EU Art.&nbsp;27 representative</strong>. If we
          offer the Service to users in the United Kingdom, a UK representative may be appointed for
          UK users; any such appointment will be noted here.
        </p>
      </Section>

      <Section heading="2. Information we collect">
        <ul>
          <li>
            <strong>Account information.</strong> If you sign in with Google (our primary sign-in
            method), we receive your name, email address, and profile picture from your Google
            account. Sign-in with GitHub or Discord may be offered in future but is currently
            disabled.
          </li>
          <li>
            <strong>Age confirmation.</strong> A self-declaration that you are 18 or older. For
            account holders we record a server-side verification verdict
            (<code>app_metadata.age_verified</code>) and your <strong>birth year only</strong> — not
            your full date of birth.
          </li>
          <li>
            <strong>Learning content you submit.</strong> The problems you answer, your written
            reasoning, and any photos of your handwritten work that you upload for grading.
          </li>
          <li>
            <strong>Progress data.</strong> Your scores, reasoning rubrics, attempt history, and
            concept mastery.
          </li>
          <li>
            <strong>Billing data.</strong> If you subscribe to Pro, your purchase is sold and
            processed by {LEGAL.mor} ({LEGAL.morEntity}) as the seller of record. We receive your
            subscription status and identifiers; we do <em>not</em> receive or store your full card
            details.
          </li>
          <li>
            <strong>Technical/usage data.</strong> Aggregate, privacy-friendly analytics about page
            views and performance (see &quot;Cookies and analytics&quot; below).
          </li>
        </ul>
        <p>
          As a guest (not signed in), your progress is stored only in your own browser&apos;s local
          storage and is not sent to our servers except when an answer (and any photo) is submitted
          for grading.
        </p>
      </Section>

      <Section heading="3. Why we use your data and our legal basis (GDPR Art. 6)">
        <p>For each purpose we rely on a specific lawful basis:</p>
        <ul>
          <li>
            <strong>Create and operate your account; authenticate you.</strong> Legal basis:{" "}
            <strong>contract</strong> (Art.&nbsp;6(1)(b)).
          </li>
          <li>
            <strong>Confirm you are 18+ (the Service is adults-only).</strong> Legal basis:{" "}
            <strong>legal obligation / legitimate interests</strong> (Art.&nbsp;6(1)(c)/(f)).
          </li>
          <li>
            <strong>Grade your reasoning and save your progress</strong> (including sending your
            answer, the question, and any uploaded photo to our AI provider). Legal basis:{" "}
            <strong>contract</strong> (Art.&nbsp;6(1)(b)) and our <strong>legitimate interest</strong>{" "}
            in providing accurate, automated educational feedback (Art.&nbsp;6(1)(f)).
          </li>
          <li>
            <strong>Process and manage your Pro subscription.</strong> Legal basis:{" "}
            <strong>contract</strong> (Art.&nbsp;6(1)(b)) and, for retaining the records we are
            required to keep, <strong>legal obligation</strong> (Art.&nbsp;6(1)(c)).
          </li>
          <li>
            <strong>Maintain security, prevent abuse, and debug problems.</strong> Legal basis:{" "}
            <strong>legitimate interests</strong> (Art.&nbsp;6(1)(f); Recital&nbsp;49).
          </li>
          <li>
            <strong>Product analytics and performance measurement.</strong> Legal basis:{" "}
            <strong>consent</strong> (Art.&nbsp;6(1)(a) + ePrivacy; see &quot;Cookies and
            analytics&quot;).
          </li>
        </ul>
        <p>
          Where we rely on <strong>legitimate interests</strong>, you may <strong>object</strong>{" "}
          (see &quot;Your rights&quot;). Where we rely on <strong>consent</strong>, you may{" "}
          <strong>withdraw it at any time</strong> without affecting prior processing.
        </p>
      </Section>

      <Section heading="4. AI grading and photos (automated processing)">
        <p>
          Your work is graded by an <strong>AI model</strong> run by our inference provider,{" "}
          <strong>Groq</strong>, on infrastructure in the <strong>United States</strong> (Google
          Cloud / GCP). To produce a grade, the text of your answer, the question, and any photo of
          your handwritten work you upload are sent to Groq. Your submissions and photos are{" "}
          <strong>not used to train</strong> the model, and the photo is processed transiently to
          read the work shown — we do not keep a copy on our servers and we do not use facial
          recognition or any technique to identify you from an image.
        </p>
        <p>
          Before any photo leaves our servers, we <strong>strip its EXIF metadata server-side</strong>,
          which removes any precise GPS location and other embedded metadata that a camera may have
          recorded — so that information is never sent to the AI provider.
        </p>
        <p>
          <strong>Please do not include personal or sensitive information</strong> in your answers,
          and do not upload images containing faces, ID documents, or information about your health
          or beliefs. We do not ask for and do not want special-category data (GDPR Art.&nbsp;9).
        </p>
      </Section>

      <Section heading="5. Automated decision-making (GDPR Art. 22)">
        <p>
          Grading is automated and amounts to <strong>profiling</strong> in the GDPR sense. In our
          assessment it does <strong>not</strong> produce a legal or similarly significant effect on
          you: it is <strong>user-initiated</strong>, <strong>advisory and for your learning only</strong>,
          and is <strong>computed server-side from a published rubric</strong>; it is not an exam,
          qualification, or certification, and is not shared with any institution. For these reasons
          we do not consider it a &quot;solely automated decision with legal or similarly significant
          effect&quot; under Art.&nbsp;22. Even so, you may contact us at{" "}
          <strong>{LEGAL.contactEmail}</strong> to discuss a result and request{" "}
          <strong>human review</strong>. See our <a href="/legal/ai-transparency">AI Transparency
          Notice</a>.
        </p>
      </Section>

      <Section heading="6. Who we share data with (recipients)">
        <p>
          We share data only as needed to run the Service. The providers below act either as our{" "}
          <strong>processors</strong> (on our instructions, under data-processing agreements) or as{" "}
          <strong>independent controllers</strong> (they determine their own purposes for certain
          data). We do <strong>not</strong> sell your personal data. A current list is in our{" "}
          <a href="/legal/sub-processors">Sub-processors</a> page.
        </p>
        <p>
          <strong>Processors:</strong>
        </p>
        <ul>
          <li><strong>Supabase</strong> — authentication and database (stores your account and progress).</li>
          <li>
            <strong>Groq</strong> — AI inference that grades your work, in the United States (Google
            Cloud / GCP) (see &quot;AI grading and photos&quot; above).
          </li>
          <li><strong>Vercel</strong> — hosting and privacy-friendly analytics (Web Analytics &amp; Speed Insights).</li>
          <li><strong>Ahrefs</strong> — privacy-friendly, cookieless web analytics for understanding traffic.</li>
          <li>
            <strong>Resend</strong> — transactional email (e.g. the durable-medium acknowledgement
            sent after a withdrawal), in the United States. <strong>Dormant</strong> until configured:
            no email is sent unless the provider is enabled.
          </li>
        </ul>
        <p>
          <strong>Independent controllers:</strong>
        </p>
        <ul>
          <li>
            <strong>{LEGAL.mor} ({LEGAL.morEntity})</strong> — the <strong>Merchant of Record /
            seller of record</strong> for Pro. Polar determines its own purposes as an independent
            controller for processing your payment and for tax/VAT. Polar is not our payment
            processor or our processor.
          </li>
          <li>
            <strong>Google</strong> — when you choose &quot;Sign in with Google&quot;, Google acts as
            an independent controller for federated authentication.
          </li>
        </ul>
      </Section>

      <Section heading="7. Cookies and analytics">
        <p>
          We use a small amount of browser storage that is <strong>strictly necessary</strong> to keep
          you signed in (via Supabase), to remember preferences such as your theme, and to remember your
          analytics choice. These do not require consent.
        </p>
        <p>
          For <strong>analytics</strong> we use Vercel Web Analytics, Vercel Speed Insights, and Ahrefs
          Web Analytics. They are designed to be privacy-friendly — they do <strong>not</strong> use
          advertising cookies and do not collect personally identifiable information for cross-site
          tracking — but they are not strictly necessary, so they load <strong>only after you opt in</strong>
          via our cookie banner. You can change or withdraw your choice at any time through
          &quot;Cookie preferences&quot; in the footer, and we honor Global Privacy Control (GPC) signals
          as an opt-out. We do not use third-party advertising trackers. See our{" "}
          <a href="/cookies">Cookie Policy</a> for the full list.
        </p>
      </Section>

      <Section heading="8. How long we keep your data (retention)">
        <ul>
          <li>
            <strong>Account &amp; progress data</strong> (name, email, profile picture, birth year,
            scores, rubrics, attempt history, mastery) — kept for the <strong>life of your account</strong>.
            You can reset your progress from <em>Dashboard → Reset my progress</em>, or delete your
            account entirely (see &quot;Your rights&quot;).
          </li>
          <li>
            <strong>Photos of handwritten work</strong> — processed transiently to produce a grade and{" "}
            <strong>not stored</strong> on our servers afterward.
          </li>
          <li>
            <strong>Security &amp; event logs</strong> (such as IP address and the route accessed) —
            kept on a short-lived basis. Where an event is <strong>flagged for abuse</strong> (for
            example a suspected prompt-injection attempt), the log additionally retains a{" "}
            <strong>short snippet of the typed answer text</strong> that triggered the flag, together
            with the IP address, so we can investigate. We prune these logs periodically on a{" "}
            <strong>best-effort basis, targeting about 90 days</strong>; because pruning runs
            opportunistically rather than on a fixed schedule, individual records may persist somewhat
            longer before they are removed.
          </li>
          <li>
            <strong>Analytics data</strong> — retained for about <strong>14 months</strong> per our
            analytics providers&apos; standard configuration.
          </li>
          <li>
            <strong>Billing &amp; tax records</strong> — retained by {LEGAL.mor} as Merchant of Record
            for the <strong>statutory tax/accounting periods</strong> required by law, even after your
            account is deleted. Our local subscription record is deleted with your account.
          </li>
        </ul>
        <p>We keep data no longer than necessary (GDPR Art.&nbsp;5(1)(e)).</p>
      </Section>

      <Section heading="9. Your rights">
        <p>
          Depending on where you live (for example, under the EU/UK GDPR or US state laws), you have
          the right to <strong>access</strong> (Art.&nbsp;15), <strong>rectify</strong>{" "}
          (Art.&nbsp;16), <strong>erase</strong> (Art.&nbsp;17), <strong>restrict</strong>{" "}
          (Art.&nbsp;18), and <strong>port</strong> (Art.&nbsp;20) your personal data, to{" "}
          <strong>object</strong> to certain processing (Art.&nbsp;21), to <strong>withdraw
          consent</strong> (Art.&nbsp;7(3)), and not to be subject to a solely automated decision
          with legal or similarly significant effect (Art.&nbsp;22; see Section&nbsp;5). You can:
        </p>
        <ul>
          <li>Delete your scores and history in-app via <em>Dashboard → Reset my progress</em>.</li>
          <li>
            Permanently delete your entire account and all associated data (and cancel any Pro
            subscription) in-app via <em>Dashboard → Delete account</em>, or by contacting us at
            <strong> {LEGAL.contactEmail}</strong>.
          </li>
        </ul>
        <p>
          We respond to verified requests within <strong>one month</strong> (extendable by two
          further months for complex or numerous requests, with notice). Requests are free unless
          manifestly unfounded or excessive.
        </p>
        <p>
          If you are in the EU/EEA, you also have the right to lodge a complaint with a data-protection
          supervisory authority. Our lead authority is the {LEGAL.supervisoryAuthority}. UK users may
          complain to the ICO (ico.org.uk); US residents, see our{" "}
          <a href="/legal/us-privacy">US State Privacy Notice</a>.
        </p>
      </Section>

      <Section heading="10. Age requirement (18+)">
        <p>
          noobtopro is an <strong>adults-only service intended for users aged 18 and older</strong>.
          The Service is not directed to children or minors, and we do not knowingly collect personal
          information from anyone under 18. We rely on an <strong>age self-declaration</strong> at
          sign-up; for account holders we record a server-side verification verdict and your{" "}
          <strong>birth year only</strong> (not your full date of birth). If you believe a person
          under 18 has provided us personal information, contact us at <strong>{LEGAL.contactEmail}</strong>{" "}
          and we will delete it.
        </p>
      </Section>

      <Section heading="11. Security">
        <p>
          Data is encrypted in transit. Access to your account data is restricted to you through
          row-level security, and sensitive operations run server-side. We will notify the competent
          supervisory authority and affected users of a personal-data breach where required by law
          (GDPR Arts.&nbsp;33–34). No method of transmission or storage is perfectly secure, but we
          work to protect your information. See our <a href="/legal/data-retention">Data Retention
          &amp; Security</a> page.
        </p>
      </Section>

      <Section heading="12. International transfers">
        <p>
          Some recipients process data outside the EU/EEA and UK, principally in the United States.
          Where this happens we rely on appropriate safeguards for each recipient:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> and <strong>Google</strong> — the{" "}
            <strong>EU-US Data Privacy Framework</strong> (with UK and Swiss extensions), under which
            both are certified.
          </li>
          <li>
            <strong>Supabase</strong> (US, AWS us-east-1), <strong>Groq</strong> (US, Google Cloud /
            GCP), <strong>Resend</strong> (US; the dormant transactional-email provider), and{" "}
            <strong>Ahrefs</strong> (Ahrefs Pte. Ltd., a Singapore entity; data processed in the{" "}
            <strong>United States</strong> on AWS) — the European Commission&apos;s{" "}
            <strong>Standard Contractual Clauses</strong> (plus the UK Addendum), together with a{" "}
            <strong>Transfer Impact Assessment</strong> and supplementary measures.
          </li>
          <li>
            <strong>{LEGAL.mor}</strong> acts as Merchant of Record and independent controller under
            its own policy and safeguards.
          </li>
        </ul>
        <p>
          You can request a copy of the relevant safeguards by emailing{" "}
          <strong>{LEGAL.contactEmail}</strong>. See our{" "}
          <a href="/legal/sub-processors">Sub-processors</a> page for the full mechanism detail.
        </p>
      </Section>

      <Section heading="13. Changes to this Policy">
        <p>
          We may update this Policy from time to time. We will update the &quot;Last updated&quot; date
          and, for material changes, provide a more prominent notice.
        </p>
      </Section>

      <Section heading="14. Contact">
        <p>
          Questions about this Policy or your data: <strong>{LEGAL.contactEmail}</strong>,
          <strong> {LEGAL.businessName}, {LEGAL.city}, {LEGAL.country}</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
