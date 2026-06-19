import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "U.S. State Privacy Notice",
  description:
    "Privacy disclosures for residents of U.S. states with comprehensive privacy laws (California CCPA/CPRA, Virginia, Colorado, Connecticut, Utah, Oregon, Montana, Texas and others) — the categories of personal information we collect, why, your rights, and how to exercise them.",
  alternates: { canonical: "/legal/us-privacy" },
};

export default function USPrivacyPage() {
  return (
    <LegalLayout title="U.S. State Privacy Notice">
      <p>
        This Notice applies to residents of U.S. states with comprehensive privacy laws — including
        California (CCPA/CPRA), Virginia, Colorado, Connecticut, Utah, Oregon, Montana, Texas and
        others. It supplements our <a href="/privacy">Privacy Policy</a> and, for those residents,
        controls where it conflicts. {LEGAL.siteName} ({LEGAL.domainBare}) is operated by{" "}
        {LEGAL.businessName}, a {LEGAL.businessForm}; this Notice applies because we offer the
        Service to U.S. consumers.
      </p>

      <Section heading="1. Categories of personal information we collect">
        <p>
          We collect the following categories of personal information, from you, from your device,
          and from our service providers, and use them for the purposes described:
        </p>
        <ul>
          <li>
            <strong>Identifiers</strong> — such as your name, email, account ID, IP address, and
            device/cookie identifiers. Used to provide and secure the Service and manage your
            account.
          </li>
          <li>
            <strong>Commercial information</strong> — such as your subscription tier, payment status,
            and history. Used for billing and to deliver Pro features.
          </li>
          <li>
            <strong>Internet or network activity</strong> — such as pages viewed, usage, and
            referrers. Used for analytics and to improve the Service.
          </li>
          <li>
            <strong>Geolocation (approximate)</strong> — coarse location derived from your IP
            address. Used for security and analytics.
          </li>
          <li>
            <strong>User content</strong> — the answers you type and photos of your work that you
            upload for AI grading.
          </li>
          <li>
            <strong>Sensitive personal information</strong> — your submissions may incidentally
            reveal sensitive information (for example, health, beliefs, message contents, or precise
            geolocation contained in a photo). We use sensitive personal information{" "}
            <strong>only</strong> to provide and secure the grading service and for other legally
            permitted purposes — not to infer characteristics about you and not for advertising.
          </li>
          <li>
            <strong>Inferences</strong> — performance and usage inferences derived from the above.
            Used to improve the Service.
          </li>
        </ul>
        <p>
          For how long we keep this information, see the retention section of our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </Section>

      <Section heading="2. We do not sell your personal information">
        <p>
          We do <strong>not</strong> sell your personal information for money. Where our use of
          analytics could be considered &quot;sharing&quot; for cross-context behavioral advertising
          or targeted advertising under state law, you have the right to opt out, as described below,
          and we honor browser opt-out preference signals.
        </p>
      </Section>

      <Section heading="3. Your rights">
        <p>Depending on your state of residence, you may have the right to:</p>
        <ul>
          <li>
            <strong>Know and access</strong> the personal information we have collected about you.
          </li>
          <li>
            <strong>Delete</strong> personal information we have collected from you.
          </li>
          <li>
            <strong>Correct</strong> inaccurate personal information.
          </li>
          <li>
            <strong>Opt out</strong> of any &quot;sale&quot; or &quot;sharing&quot; of your personal
            information and of targeted advertising and certain profiling.
          </li>
          <li>
            <strong>Limit the use of your sensitive personal information</strong> (see Section 4).
          </li>
          <li>
            <strong>Non-discrimination</strong> for exercising your rights (see Section 6).
          </li>
          <li>
            In Virginia, Colorado, Connecticut, Oregon, Montana, Texas and certain other states, the
            right to <strong>appeal</strong> a denial of your request. To appeal, email{" "}
            <strong>{LEGAL.contactEmail}</strong> with &quot;Appeal&quot; in the subject line. If we
            deny your appeal, you may contact your state Attorney General.
          </li>
        </ul>
      </Section>

      <Section heading="4. Right to limit the use of sensitive personal information">
        <p>
          Some submissions could reveal sensitive personal information — such as health, beliefs,
          racial or ethnic origin, message contents, or precise geolocation contained in a photo. We
          use sensitive personal information <strong>only</strong> to provide and secure the grading
          service and for other legally permitted purposes — <strong>not</strong> to infer
          characteristics about you and <strong>not</strong> for advertising.
        </p>
      </Section>

      <Section heading="5. Opt-out preference signals (Global Privacy Control)">
        <p>
          We honor the <strong>Global Privacy Control (GPC)</strong>. If your browser sends a GPC
          signal, we treat it as a valid opt-out for that browser or device — and for your account
          when you are logged in — and we indicate that your opt-out request was honored. You do not
          need to be a Pro subscriber to exercise this, and we will not ask you to opt back in for at
          least 12 months.
        </p>
      </Section>

      <Section heading="6. How to exercise your rights">
        <p>
          To make a request, email <strong>{LEGAL.contactEmail}</strong>. Because we operate online
          and interact with you primarily through your account, we provide this online method rather
          than a toll-free number, as permitted by California law. We verify your identity (typically
          via your account email). <strong>Authorized agents</strong> may submit requests on your
          behalf with your written permission, or via GPC for opt-outs. We confirm receipt and
          respond within the timeframes required by applicable law (generally up to 45 days,
          extendable as the law allows); most requests are free.
        </p>
      </Section>

      <Section heading="7. Non-discrimination">
        <p>
          We will not discriminate or retaliate against you for exercising your privacy rights. Our
          free and Pro tiers differ by the value of the services they provide, not by your exercise
          of privacy rights, and <strong>both tiers receive the same privacy rights and
          opt-outs</strong>.
        </p>
      </Section>

      <Section heading="8. Contact">
        <p>
          Questions about this Notice, or to exercise your rights:{" "}
          <strong>{LEGAL.contactEmail}</strong> — {LEGAL.businessName}, {LEGAL.city},{" "}
          {LEGAL.country}. California residents may also contact the California Privacy Protection
          Agency (CPPA) or the California Attorney General.
        </p>
      </Section>
    </LegalLayout>
  );
}
