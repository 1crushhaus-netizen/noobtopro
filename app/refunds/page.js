import LegalLayout, { Section } from "@/components/LegalLayout";

export const metadata = {
  title: "Refund & Cancellation Policy — noobtopro",
  description: "How noobtopro Pro billing, cancellations, and refunds work.",
};

export default function RefundsPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy">
      <p>
        This policy explains how billing, cancellations, and refunds work for the noobtopro
        &quot;Pro&quot; subscription. It supplements our <a href="/terms">Terms of Service</a>.
        Payments are processed by <strong>Polar</strong>, acting as Merchant of Record.
      </p>

      <Section heading="1. Subscription terms">
        <p>
          Pro is billed on a recurring <strong>monthly</strong> basis at the price shown at checkout
          (currently <strong>€9.99/month</strong>, taxes may apply). Your subscription renews
          automatically each billing period until you cancel.
        </p>
      </Section>

      <Section heading="2. How to cancel">
        <p>
          You can cancel at any time from <em>Dashboard → Manage subscription</em>, which opens the
          secure billing portal. When you cancel, your Pro access continues until the end of the
          current paid period, after which it is not renewed. You will not be charged again after
          cancellation.
        </p>
      </Section>

      <Section heading="3. Refunds">
        <p>
          If you are a consumer in the EU/EEA or UK, you may have a statutory right to withdraw within
          14 days of purchase, subject to the rules on digital services you have begun using.
          <strong> [Confirm your refund terms with counsel and state them here]</strong> — for
          example, whether you offer a no-questions-asked refund window, pro-rated refunds, or
          refunds at your discretion.
        </p>
        <p>
          To request a refund, contact <strong>[support@your-domain]</strong> with your account email
          and the date of the charge. Approved refunds are returned to your original payment method via
          Polar.
        </p>
      </Section>

      <Section heading="4. Failed or disputed payments">
        <p>
          If a renewal payment fails, we may retry and/or suspend Pro access until payment succeeds.
          If you believe you were charged in error, contact us before initiating a chargeback so we can
          resolve it quickly.
        </p>
      </Section>

      <Section heading="5. Price changes">
        <p>
          We may change the subscription price. Any change applies to future billing periods, and we
          will provide notice before it takes effect so you can cancel if you do not agree.
        </p>
      </Section>

      <Section heading="6. Contact">
        <p>
          Billing questions: <strong>[support@your-domain]</strong>,
          <strong> [Company Legal Name]</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
