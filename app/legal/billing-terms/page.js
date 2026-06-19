import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";
import { WITHDRAWAL_WINDOW_DAYS } from "@/lib/consent";

export const metadata = {
  title: "Subscription & Billing Terms",
  description:
    "How noobtopro Pro billing works — the €9.99/month price (tax included), monthly automatic renewal until you cancel, Polar as our Merchant of Record, how to cancel, VAT handling, and your EU 14-day right of withdrawal.",
  alternates: { canonical: "/legal/billing-terms" },
};

export default function BillingTermsPage() {
  return (
    <LegalLayout title="Subscription &amp; Billing Terms">
      <p>
        These Subscription &amp; Billing Terms explain how payment works for{" "}
        <strong>{LEGAL.siteName} Pro</strong> ({LEGAL.domainBare}). They supplement our{" "}
        <a href="/terms">Terms of Service</a> and our{" "}
        <a href="/refunds">Refund &amp; Cancellation Policy</a>. The Service is operated by{" "}
        {LEGAL.businessName}, a {LEGAL.businessForm}.
      </p>

      <Section heading="1. Free and paid tiers">
        <p>
          {LEGAL.siteName} offers a free tier and an optional paid{" "}
          <strong>&quot;Pro&quot;</strong> subscription. You can use the free tier without
          providing any payment information. You only pay if you choose to subscribe to Pro.
        </p>
      </Section>

      <Section heading="2. Merchant of Record">
        <p>
          Your purchase of Pro is sold to you and processed by <strong>{LEGAL.mor}</strong> ({LEGAL.morEntity}),
          acting as our <strong>Merchant of Record</strong> — the <strong>seller of record</strong>{" "}
          for the transaction. {LEGAL.mor} handles checkout, billing, payment processing, applicable
          taxes, receipts, refunds, and the subscription management portal, under its own terms and
          privacy policy (see{" "}
          <a href={LEGAL.morSite} target="_blank" rel="noopener noreferrer">
            {LEGAL.morSite}
          </a>
          ). {LEGAL.businessName} remains responsible for providing the Pro service and for the
          accuracy of these disclosures.
        </p>
      </Section>

      <Section heading="3. Price, billing cycle, and automatic renewal">
        <ul>
          <li>
            <strong>Price:</strong> <strong>&euro;9.99 per month</strong>, inclusive of applicable
            tax (tax is calculated and collected by {LEGAL.mor}).
          </li>
          <li>
            <strong>Billing cycle:</strong> monthly.
          </li>
          <li>
            <strong>Automatic renewal:</strong> your Pro subscription{" "}
            <strong>automatically renews each month</strong>, and your payment method will be{" "}
            <strong>charged &euro;9.99 on each renewal date until you cancel</strong>. By subscribing,
            you authorize these recurring monthly charges.
          </li>
          <li>
            <strong>Billing currency:</strong> the price is billed in <strong>euros (EUR)</strong>. If
            you pay with a non-euro card (for example, a US card), your card network converts the
            &euro;9.99 to your card&apos;s currency at its own <strong>foreign-exchange rate</strong>,
            and your bank may add its own conversion or foreign-transaction fee; the EUR amount we charge
            does not change.
          </li>
        </ul>
      </Section>

      <Section heading="4. Your consent">
        <p>
          Before you are charged, we present the renewal terms — the price, the monthly frequency,
          that the subscription auto-renews until cancelled, and how to cancel — and obtain your{" "}
          <strong>affirmative consent</strong>. We and/or {LEGAL.mor} retain a record of that consent
          as required by law.
        </p>
      </Section>

      <Section heading="5. How to cancel">
        <p>
          You can <strong>cancel anytime, as easily as you signed up</strong>. Use{" "}
          <strong>&quot;Manage subscription&quot;</strong> in your account to open the{" "}
          <strong>{LEGAL.mor} customer portal</strong>, or contact us at{" "}
          <strong>{LEGAL.contactEmail}</strong>. There are no phone calls, retention steps, or extra
          hurdles. Cancellation takes effect at the <strong>end of the current paid billing period</strong>;
          you keep Pro access until then, and you will not be charged again afterwards.
        </p>
      </Section>

      <Section heading="6. Taxes (VAT)">
        <p>
          As our Merchant of Record, <strong>{LEGAL.mor} calculates, collects, and remits</strong>{" "}
          any VAT or other sales tax due based on your location (including via the EU One-Stop-Shop).
          The &euro;9.99 monthly price is <strong>inclusive of applicable tax</strong>; we do not
          separately add tax to this purchase.
        </p>
        <p>
          {LEGAL.businessName} itself is a small business under the German{" "}
          <em>Kleinunternehmerregelung</em> (&sect; 19 UStG) and does not charge VAT on its own
          account. That does not change the price you pay: because {LEGAL.mor} is the seller of record,
          {" "}{LEGAL.mor} still collects and remits any consumer VAT due, and the &euro;9.99 you see at
          checkout remains the full tax-inclusive total.
        </p>
      </Section>

      <Section heading="7. Right of withdrawal and refunds">
        <p>
          If you are a consumer in the EU/EEA, you have a{" "}
          <strong>{WITHDRAWAL_WINDOW_DAYS}-day right of withdrawal</strong> when you subscribe. You can
          exercise it yourself at any time during that window using the self-serve{" "}
          <strong>&quot;Withdraw from contract here&quot;</strong> control in your dashboard, which
          immediately ends your subscription and issues a pro-rata refund. How that right applies to a
          digital service like Pro — including the immediate-access consent at checkout and how the
          pro-rata refund is calculated and paid through {LEGAL.mor} as Merchant of Record — is set out
          in detail in our <a href="/refunds">Refund &amp; Cancellation Policy</a>.
        </p>
        <p>
          Although {LEGAL.mor} runs checkout and billing as Merchant of Record,{" "}
          <strong>{LEGAL.businessName} remains a co-responsible trader</strong> toward you under
          consumer law. Using a Merchant of Record does <strong>not</strong> offload our consumer-law
          duties (including your right of withdrawal and your rights for defective or undelivered
          service); you can always raise these directly with us at <strong>{LEGAL.contactEmail}</strong>.
        </p>
      </Section>

      <Section heading="8. Renewal and price-change notices">
        <p>
          As the <strong>seller of record</strong>, <strong>{LEGAL.mor} emails your receipts and any
          renewal or price-change notices</strong> (to the address you used at checkout); {LEGAL.businessName}
          does not operate a separate billing mailer. Your <strong>next renewal date is always visible in
          the {LEGAL.mor} billing portal</strong> (open it via <strong>&quot;Manage subscription&quot;</strong>
          in your account), so you can check it at any time without waiting for an email.
        </p>
        <p>
          If we change the price, you will receive <strong>at least 7 days&apos; advance notice</strong>{" "}
          before the new price takes effect, sent to you by {LEGAL.mor} (the channel you selected at
          checkout, i.e. {LEGAL.mor} email). Any change applies only to <strong>future</strong> billing
          periods. You have the <strong>right to cancel before the change takes effect</strong>; continued
          use after a disclosed change is acceptance, and if you do not agree you can cancel through the
          {" "}{LEGAL.mor} portal before the next renewal date.
        </p>
      </Section>

      <Section heading="9. Failed payments">
        <p>
          If a charge fails, {LEGAL.mor} may retry the payment and/or your Pro access may be suspended
          or downgraded until payment succeeds.
        </p>
      </Section>

      <Section heading="10. Eligibility">
        <p>Pro is offered only to adults who are 18 years of age or older.</p>
      </Section>

      <Section heading="11. Changes to these terms">
        <p>
          We may update these Subscription &amp; Billing Terms from time to time, with notice of any
          material changes as required by law. These terms are governed by {LEGAL.governingLaw}, and
          the mandatory consumer protections of your country of residence are preserved (see our{" "}
          <a href="/terms">Terms of Service</a>).
        </p>
      </Section>

      <Section heading="12. Contact">
        <p>
          Questions about billing or cancellation: <strong>{LEGAL.contactEmail}</strong> —{" "}
          {LEGAL.businessName}, {LEGAL.city}, {LEGAL.country}. For payment, receipt, or chargeback
          matters, you can also contact our Merchant of Record, {LEGAL.mor}, at{" "}
          <a href={LEGAL.morSite} target="_blank" rel="noopener noreferrer">
            {LEGAL.morSite}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
