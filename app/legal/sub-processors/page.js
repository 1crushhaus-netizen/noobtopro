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
              <th>DPA / legal terms</th>
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
              <td>
                <a href="https://supabase.com/legal/dpa" rel="noopener noreferrer" target="_blank">
                  supabase.com/legal/dpa
                </a>
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
                Standard Contractual Clauses (Module 2) + Transfer Impact Assessment; we rely on
                Groq&rsquo;s zero-data-retention setting and its no-training commitment
              </td>
              <td>
                <a
                  href="https://console.groq.com/docs/legal/customer-data-processing-addendum"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Groq DPA
                </a>
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
              <td>
                <a href="https://polar.sh/legal/privacy" rel="noopener noreferrer" target="_blank">
                  polar.sh/legal/privacy
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Vercel, Inc.</strong>
              </td>
              <td>Processor</td>
              <td>Hosting / CDN, Web Analytics, and Speed Insights</td>
              <td>
                Request, log, and IP-derived metadata; deployment data
              </td>
              <td>USA (AWS; default US)</td>
              <td>
                EU&ndash;US Data Privacy Framework (with UK and Swiss extensions); Standard
                Contractual Clauses as a fallback
              </td>
              <td>
                <a href="https://vercel.com/legal/dpa" rel="noopener noreferrer" target="_blank">
                  vercel.com/legal/dpa
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Ahrefs</strong> (Ahrefs Pte. Ltd., Singapore)
              </td>
              <td>Processor</td>
              <td>Privacy-friendly, cookieless web analytics</td>
              <td>
                Aggregated traffic metrics
              </td>
              <td>USA (AWS EC2)</td>
              <td>
                Standard Contractual Clauses (Modules 2/3) + Transfer Impact Assessment;
                data is transferred to and stored in the United States
              </td>
              <td>
                <a
                  href="https://ahrefs.com/legal/data-processing-addendum"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Ahrefs DPA
                </a>
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
              <td>
                <a
                  href="https://policies.google.com/privacy"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Google Privacy
                </a>
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Additional sign-in providers (currently disabled).</strong> Our codebase also
          supports federated sign-in with <strong>GitHub</strong> and <strong>Discord</strong>,
          which would act as independent controllers in the same way as Google. These options are{" "}
          <strong>feature-flagged off</strong> and not in use today; if we enable them we will add
          them to this list and update the &quot;Last updated&quot; date.
        </p>
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
          Several of these providers are located outside the EEA/UK/Switzerland &mdash; principally
          in the <strong>United States</strong> (Ahrefs, although a Singapore entity, transfers and
          stores the analytics data on AWS infrastructure in the United States). Whenever we
          transfer your data there, we rely on an appropriate safeguard:{" "}
          <strong>EU&ndash;US Data Privacy Framework adequacy</strong> for certified recipients
          (Vercel, Google); or <strong>Standard Contractual Clauses</strong> together with the
          UK&nbsp;Addendum, a Transfer Impact Assessment, and supplementary measures (encryption,
          data-minimisation, and reliance on zero-retention settings) for Supabase, Groq, and
          Ahrefs. For payments, <strong>Polar</strong> acts as Merchant of Record and independent
          controller under its own policy (with Stripe). You can request a copy of the relevant
          safeguards at <strong>{LEGAL.contactEmail}</strong>.
        </p>
        <p>
          The EU&ndash;US Data Privacy Framework is currently under appeal before the EU courts
          (Case&nbsp;C-703/25&nbsp;P). We monitor this and maintain Standard Contractual Clauses as a
          fallback safeguard for the DPF-certified recipients above.
        </p>
      </Section>

      <Section heading="4. Changes to this list">
        <p>
          We may add or replace sub-processors as the Service evolves. We will give at least{" "}
          <strong>30 days&rsquo; advance notice</strong> of a new sub-processor &mdash; by updating
          this page and, where appropriate, by email &mdash; so that you have an opportunity to
          object before the change takes effect. This list was last updated on{" "}
          <strong>{LEGAL.lastUpdated}</strong>. For more on how we handle your data, see our{" "}
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
