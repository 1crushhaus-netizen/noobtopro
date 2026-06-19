import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Data Retention & Security",
  description:
    "What data noobtopro keeps and for how long, how you can delete it, the safeguards we use to protect it, and how we handle a personal-data breach.",
  alternates: { canonical: "/legal/data-retention" },
};

export default function DataRetentionPage() {
  return (
    <LegalLayout title="Data Retention &amp; Security">
      <p>
        This page explains how long {LEGAL.siteName} ({LEGAL.domainBare}) keeps your information, how
        you can delete it yourself, the measures we use to keep it safe, and what we do if a
        personal-data breach ever occurs. The operator and data controller is {LEGAL.businessName},
        a {LEGAL.businessForm}. It supplements, and should be read together with, our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <Section heading="1. How long we keep your data">
        <p>
          We keep personal data only for as long as we need it for the purpose it was collected, or
          for as long as the law requires us to. The table below summarizes the main categories.
        </p>
        <ul>
          <li>
            <strong>Account &amp; sign-in details</strong> (your name, email, profile picture from
            an OAuth provider, and the birth year used for age verification) are kept for the{" "}
            <strong>life of your account</strong>. If an account stays inactive for a long period we
            may delete it after giving you notice first.
          </li>
          <li>
            <strong>Scores, ranks and learning history</strong> (your scores, rating, rank changes
            and concept mastery) are kept for the life of your account, or until you reset your
            progress.
          </li>
          <li>
            <strong>Your answers and feedback</strong> (the question, your free-text answer, and the
            rubric-based feedback) are kept for the life of your account.
          </li>
          <li>
            <strong>Handwriting photos are not stored.</strong> When you submit a photo for grading
            it is sent to our grading provider, processed, and then discarded — we do not keep a copy
            on our servers. The recognized answer text, however, is stored as described above.
          </li>
          <li>
            <strong>Subscription &amp; billing records.</strong> We store basic subscription status
            and identifiers (no card details). Payments are handled by our merchant of record,{" "}
            {LEGAL.mor}, who retains the tax and invoicing records that they are legally required to
            keep. Our local subscription records are deleted when your account is deleted.
          </li>
          <li>
            <strong>Security &amp; event logs</strong> (such as a request&rsquo;s IP address and the
            route accessed) are kept on a short-lived basis and then deleted, so we can protect the
            Service against abuse.
          </li>
          <li>
            <strong>Analytics</strong> (aggregate page views and performance) are retained according
            to our analytics providers&rsquo; standard configuration; see our{" "}
            <a href="/cookies">Cookie Policy</a>.
          </li>
        </ul>
        <p>
          Where a specific statutory retention period applies (for example, tax and accounting
          records held by our payment provider), that period overrides the general rule above and we
          keep the relevant records for as long as the law requires.
        </p>
      </Section>

      <Section heading="2. Deleting your data">
        <p>You stay in control of your data and can remove it directly within the app:</p>
        <ul>
          <li>
            <strong>Reset progress.</strong> You can reset your learning data — scores, attempts and
            mastery — from within your account at any time, without deleting the account itself.
          </li>
          <li>
            <strong>Delete your account.</strong> Deleting your account removes your account record
            and the associated per-user data, including your scores, attempts, answers and local
            subscription record, and cancels any active Pro subscription. Because no copy is kept,
            this action cannot be undone.
          </li>
        </ul>
        <p>
          You also have the right to request access to, correction of, or erasure of your personal
          data, and to ask for a copy in a portable format. We aim to respond to such requests within
          one month. See the <a href="/privacy">Privacy Policy</a> for the full list of your rights
          and how to exercise them.
        </p>
      </Section>

      <Section heading="3. How we protect your data">
        <p>
          We use technical and organizational measures appropriate to the risk to keep your data
          secure, including:
        </p>
        <ul>
          <li>
            <strong>Encryption in transit.</strong> Traffic between you and the Service is encrypted
            using HTTPS/TLS.
          </li>
          <li>
            <strong>Row-level access controls.</strong> Our database uses row-level security so that
            your records are only accessible to you and to the parts of the Service authorized to
            handle them.
          </li>
          <li>
            <strong>Server-side handling of sensitive operations.</strong> Sensitive actions — such
            as account deletion and operations that use privileged credentials — are performed on the
            server and are never exposed to the browser.
          </li>
          <li>
            <strong>Access on a need-to-know basis</strong> and rate limiting and abuse detection to
            help protect against unauthorized or automated misuse.
          </li>
        </ul>
        <p>
          No method of transmission or storage is completely secure, so while we work hard to protect
          your data we cannot guarantee absolute security.
        </p>
      </Section>

      <Section heading="4. If a data breach occurs">
        <p>
          If a personal-data breach occurs that is likely to result in a risk to your rights and
          freedoms, we will notify the competent supervisory authority{" "}
          <strong>without undue delay and, where feasible, within 72 hours</strong> of becoming aware
          of it, in line with Article&nbsp;33 of the GDPR.
        </p>
        <p>
          Where a breach is likely to result in a <strong>high risk</strong> to your rights and
          freedoms, we will also inform affected users <strong>without undue delay</strong> and in
          clear, plain language, describing what happened and the steps we are taking, in line with
          Article&nbsp;34 of the GDPR. We document the facts of any breach, its effects and the
          remedial action taken.
        </p>
        <p>
          Our lead supervisory authority is the {LEGAL.supervisoryAuthority}.
        </p>
      </Section>

      <Section heading="5. Changes to this page">
        <p>
          We may update this page as our practices, providers or the law change. We will revise the
          &quot;Last updated&quot; date above when we do.
        </p>
      </Section>

      <Section heading="6. Contact">
        <p>
          Questions about data retention or security: <strong>{LEGAL.contactEmail}</strong> —{" "}
          {LEGAL.businessName}, {LEGAL.city}, {LEGAL.country}.
        </p>
      </Section>
    </LegalLayout>
  );
}
