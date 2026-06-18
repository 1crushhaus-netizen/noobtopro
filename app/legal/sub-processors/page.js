import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Sub-processors",
  description:
    "The third-party providers (sub-processors and independent recipients) that help us run noobtopro — what each one does, the data involved, where it is processed, and the transfer safeguards that apply.",
  alternates: { canonical: "/legal/sub-processors" },
};

export default function SubProcessorsPage() {
  return (
    <LegalLayout title="Sub-processors">
      <p>
        To provide {LEGAL.siteName} ({LEGAL.domainBare}) we use a small number of trusted
        third-party providers. {LEGAL.businessName}, a {LEGAL.businessForm}, is the controller of
        your personal data. The providers below act either as our <strong>processors</strong> (they
        process data on our instructions) or as <strong>independent controllers</strong> (they
        determine their own purposes for certain data). This list supplements our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <Section heading="1. Current sub-processors and recipients">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Role</th>
              <th>Purpose</th>
              <th>Personal data involved</th>
              <th>Processing location</th>
              <th>Transfer safeguard</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Supabase, Inc.</strong>
              </td>
              <td>Processor</td>
              <td>Database (Postgres), authentication, and storage</td>
              <td>
                Account and authentication identifiers (email, Google OAuth subject), profile and
                grading data
              </td>
              <td>USA (AWS us-east-1)</td>
              <td>
                Standard Contractual Clauses (Module 2) + UK Addendum + Transfer Impact Assessment;
                ISO&nbsp;27001 and SOC&nbsp;2
              </td>
            </tr>
            <tr>
              <td>
                <strong>Groq, Inc.</strong>
              </td>
              <td>Processor</td>
              <td>LLM inference / AI grading</td>
              <td>
                Typed answers; photos of handwritten work; derived outputs
              </td>
              <td>USA (Google Cloud)</td>
              <td>
                Standard Contractual Clauses (Module 2) + Transfer Impact Assessment; zero data
                retention and no-training commitment
              </td>
            </tr>
            <tr>
              <td>
                <strong>Polar Software, Inc.</strong>
              </td>
              <td>Independent controller (Merchant of Record)</td>
              <td>Payments, billing, fraud prevention, tax/VAT, and invoicing</td>
              <td>
                Name, email, and billing/transaction data (no full card numbers)
              </td>
              <td>USA</td>
              <td>
                Controller-to-controller under Polar&rsquo;s own policy and safeguards (Stripe as
                sub-processor)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Vercel, Inc.</strong>
              </td>
              <td>Processor</td>
              <td>Hosting / CDN and web analytics</td>
              <td>
                Request, log, and IP-derived metadata; deployment data
              </td>
              <td>USA (AWS; default US)</td>
              <td>
                EU&ndash;US Data Privacy Framework (with UK and Swiss extensions); Standard
                Contractual Clauses as a fallback
              </td>
            </tr>
            <tr>
              <td>
                <strong>Ahrefs Pte. Ltd.</strong>
              </td>
              <td>Processor</td>
              <td>Privacy-friendly, cookieless web analytics</td>
              <td>
                Aggregated traffic metrics
              </td>
              <td>Singapore (AWS)</td>
              <td>
                Where personal data is involved: Standard Contractual Clauses (Modules 2/3) +
                Transfer Impact Assessment (Singapore)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Google LLC</strong> (Sign in with Google)
              </td>
              <td>Independent controller</td>
              <td>Federated authentication</td>
              <td>
                Google account ID/email and authentication tokens
              </td>
              <td>USA</td>
              <td>
                EU&ndash;US Data Privacy Framework (Google LLC) and Google&rsquo;s own safeguards
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section heading="2. Onward sub-processors">
        <p>
          Some of our providers rely on their own infrastructure sub-processors. For information:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> &rarr; Amazon Web Services (AWS)
          </li>
          <li>
            <strong>Groq</strong> &rarr; Google Cloud (GCP)
          </li>
          <li>
            <strong>Polar</strong> &rarr; Stripe, LLC (USA)
          </li>
          <li>
            <strong>Vercel</strong> &rarr; Amazon Web Services (AWS)
          </li>
          <li>
            <strong>Ahrefs</strong> &rarr; Amazon Web Services (AWS EC2)
          </li>
        </ul>
      </Section>

      <Section heading="3. International data transfers">
        <p>
          Some of these providers are outside the EEA/UK/Switzerland &mdash; principally the United
          States and, for analytics, Singapore. Whenever we transfer your data there, we rely on an
          appropriate safeguard: <strong>EU&ndash;US Data Privacy Framework adequacy</strong> for
          certified recipients (Vercel, Google); or <strong>Standard Contractual Clauses</strong>{" "}
          together with the UK&nbsp;Addendum, a Transfer Impact Assessment, and supplementary
          measures (encryption, data-minimisation, zero-retention) for Supabase, Groq, and Ahrefs.
          For payments, <strong>Polar</strong> acts as Merchant of Record and independent controller
          under its own policy (with Stripe). You can request a copy of the relevant safeguards at{" "}
          <strong>{LEGAL.contactEmail}</strong>.
        </p>
      </Section>

      <Section heading="4. Changes to this list">
        <p>
          We may add or replace sub-processors as the Service evolves. When we do, we will update
          this page. For more on how we handle your data, see our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </Section>

      <Section heading="5. Contact">
        <p>
          Questions about our sub-processors: <strong>{LEGAL.contactEmail}</strong> &mdash;{" "}
          {LEGAL.businessName}, {LEGAL.city}, {LEGAL.country}.
        </p>
      </Section>
    </LegalLayout>
  );
}
