import LegalLayout, { Section } from "@/components/LegalLayout";

export const metadata = {
  title: "Privacy Policy", // root template appends " — noobtopro" (SEO P2-2)
  description: "How noobtopro collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        This Privacy Policy explains how <strong>[Company Legal Name]</strong> (&quot;noobtopro&quot;,
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
          <li><strong>Vercel</strong> — hosting and privacy-friendly analytics.</li>
          <li><strong>Polar</strong> — payment processing and subscription management (Merchant of Record).</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </Section>

      <Section heading="4. Cookies and analytics">
        <p>
          We use Vercel Web Analytics and Vercel Speed Insights, which are designed to be
          privacy-friendly: they do <strong>not</strong> use advertising cookies and do not collect
          personally identifiable information for cross-site tracking. We use a small amount of
          browser storage strictly necessary to keep you signed in (via Supabase) and to remember
          preferences such as your theme. We do not use third-party advertising trackers.
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
            <strong> [privacy@your-domain]</strong>.
          </li>
        </ul>
        <p>We will respond to verified requests within the timeframe required by applicable law.</p>
      </Section>

      <Section heading="7. Children's privacy">
        <p>
          noobtopro is intended for users aged <strong>13 and older</strong>. Users under the age of
          digital consent in their jurisdiction may use the Service only with the involvement and
          consent of a parent or guardian. We ask for age at sign-up and do not knowingly collect
          personal information from a child under 13 without verifiable parental consent. If you
          believe a child has provided us personal information without such consent, contact us at
          <strong> [privacy@your-domain]</strong> and we will delete it.
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
          Questions about this Policy or your data: <strong>[privacy@your-domain]</strong>,
          <strong> [Company Legal Name], [Registered Address]</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
