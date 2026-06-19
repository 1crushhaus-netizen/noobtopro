import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy", // root template appends " — noobtopro" (SEO P2-2)
  description:
    "How noobtopro collects, uses, shares, and protects your data — covering accounts, learning content, progress, billing, analytics, and your privacy rights.",
  // Self-referencing canonical: without this the page inherits the root layout's
  // `canonical: "/"`, which made the sitemap-listed /privacy declare the homepage as
  // its canonical ("non-canonical page in sitemap" audit warning).
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        This Privacy Policy explains how <strong>{LEGAL.businessName}</strong>, operated by{" "}
        {LEGAL.operatorName} (a {LEGAL.businessForm}) (&quot;noobtopro&quot;,
        &quot;we&quot;, &quot;us&quot;) collects, uses, and protects information when you use the
        noobtopro website and application (the &quot;Service&quot;). By using the Service you agree to
        this Policy.
      </p>

      <Section heading="1. Information we collect">
        <ul>
          <li>
            <strong>Account information.</strong> If you sign in with Google, we receive your name,
            email address, and profile picture from your Google account.
          </li>
          <li>
            <strong>Learning content you submit.</strong> The problems you answer, your written
            reasoning, and any photos of your handwritten work that you upload for grading.
          </li>
          <li>
            <strong>Progress data.</strong> Your scores, per-subject ranks, reasoning rubrics,
            attempt history, and concept mastery.
          </li>
          <li>
            <strong>Billing data.</strong> If you subscribe to Pro, payment is processed by our
            payment provider (Polar). We receive your subscription status and identifiers; we do
            <em> not</em> receive or store your full card details.
          </li>
          <li>
            <strong>Technical/usage data.</strong> Aggregate, privacy-friendly analytics about page
            views and performance (see &quot;Cookies and analytics&quot; below).
          </li>
        </ul>
        <p>
          As a guest (not signed in), your progress is stored only in your own browser&apos;s local
          storage and is not sent to our servers except when an answer is submitted for grading.
        </p>
      </Section>

      <Section heading="2. How we use your information">
        <ul>
          <li>To provide the Service: grade your reasoning, compute your rank, and save your progress.</li>
          <li>To operate the anonymous leaderboard (which shows rank distribution and your position, never names or emails).</li>
          <li>To process and manage your Pro subscription.</li>
          <li>To maintain security, prevent abuse, and debug problems.</li>
          <li>To improve the Service.</li>
        </ul>
      </Section>

      <Section heading="3. Third-party processors">
        <p>We share data with the following processors only as needed to run the Service:</p>
        <ul>
          <li><strong>Supabase</strong> — authentication and database (stores your account and progress).</li>
          <li>
            <strong>Groq</strong> — the AI models that grade your work. The text of your answer, the
            question, and any photo of your work you upload are sent to Groq to produce a grade.
            Do not include personal or sensitive information in your answers.
          </li>
          <li><strong>Vercel</strong> — hosting and privacy-friendly analytics (Web Analytics &amp; Speed Insights).</li>
          <li><strong>Ahrefs</strong> — privacy-friendly, cookieless web analytics for understanding traffic.</li>
          <li><strong>Polar</strong> — payment processing and subscription management (Merchant of Record).</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </Section>

      <Section heading="4. Cookies and analytics">
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
          as an opt-out. We do not use third-party advertising trackers.
        </p>
      </Section>

      <Section heading="5. Data retention">
        <p>
          We keep your account and progress data while your account is active. You can delete your
          progress at any time from <em>Dashboard → Reset my progress</em>, and you may request full
          account deletion (see &quot;Your rights&quot;). We may retain limited billing records where
          required by law (for example, tax and accounting obligations) even after account deletion.
        </p>
      </Section>

      <Section heading="6. Your rights">
        <p>
          Depending on where you live (for example, under the EU/UK GDPR or the CCPA), you may have
          the right to access, correct, export, or delete your personal data, and to object to or
          restrict certain processing. You can:
        </p>
        <ul>
          <li>Delete your scores and history in-app via <em>Dashboard → Reset my progress</em>.</li>
          <li>
            Permanently delete your entire account and all associated data (and cancel any Pro
            subscription) in-app via <em>Dashboard → Delete account</em>, or by contacting us at
            <strong> {LEGAL.contactEmail}</strong>.
          </li>
        </ul>
        <p>We will respond to verified requests within the timeframe required by applicable law.</p>
        <p>
          If you are in the EU/EEA, you also have the right to lodge a complaint with a data-protection
          supervisory authority. Our lead authority is the {LEGAL.supervisoryAuthority}.
        </p>
      </Section>

      <Section heading="7. Age requirement (18+)">
        <p>
          noobtopro is an <strong>adults-only service intended for users aged 18 and older</strong>.
          The Service is not directed to children or minors, and we do not knowingly collect personal
          information from anyone under 18. We ask for date of birth at sign-up to confirm eligibility.
          If you believe a person under 18 has provided us personal information, contact us at
          <strong> {LEGAL.contactEmail}</strong> and we will delete it.
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          Data is encrypted in transit. Access to your account data is restricted to you through
          row-level security, and sensitive operations run server-side. No method of transmission or
          storage is perfectly secure, but we work to protect your information.
        </p>
      </Section>

      <Section heading="9. International transfers">
        <p>
          Our processors may store and process data in countries other than yours, including the
          United States. Where required, we rely on appropriate safeguards for such transfers.
        </p>
      </Section>

      <Section heading="10. Changes to this Policy">
        <p>
          We may update this Policy from time to time. We will update the &quot;Last updated&quot; date
          and, for material changes, provide a more prominent notice.
        </p>
      </Section>

      <Section heading="11. Contact">
        <p>
          Questions about this Policy or your data: <strong>{LEGAL.contactEmail}</strong>,
          <strong> {LEGAL.businessName}, {LEGAL.city}, {LEGAL.country}</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
