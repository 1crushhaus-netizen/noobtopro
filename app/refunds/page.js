import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";
import { WITHDRAWAL_WINDOW_DAYS } from "@/lib/consent";

export const metadata = {
  title: "Refund & Cancellation Policy", // root template appends " — noobtopro" (SEO P2-2)
  description:
    "How noobtopro Pro billing, renewals, cancellations, and refunds work — including your EU/UK 14-day right of withdrawal with a pro-rata refund you can trigger yourself from the dashboard.",
  // Self-referencing canonical (see app/privacy/page.js) — avoids inheriting the
  // root layout's `canonical: "/"`.
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy">
      <p>
        This policy explains how billing, renewals, cancellations, withdrawal rights, and refunds
        work for the noobtopro &quot;Pro&quot; subscription. It supplements our{" "}
        <a href="/terms">Terms of Service</a> and{" "}
        <a href="/legal/billing-terms">Subscription &amp; Billing Terms</a>. Pro is{" "}
        <strong>sold and processed by {LEGAL.morEntity} (&quot;Polar&quot;)</strong> acting as{" "}
        <strong>Merchant of Record</strong> (the seller of record for the transaction);{" "}
        {LEGAL.businessName} provides the underlying service. All refunds are issued through Polar.
      </p>

      <Section heading="1. What you are buying">
        <p>
          Pro is a <strong>digital service</strong> giving immediate access to noobtopro&apos;s
          AI-grading features, billed on a recurring <strong>monthly</strong> basis at the price
          shown at checkout (currently <strong>€9.99/month, inclusive of any applicable taxes/VAT</strong> —
          the tax-inclusive total is shown before you pay). It renews automatically each month until
          you cancel. There is no minimum term; your only commitment is the current paid month.
        </p>
      </Section>

      <Section heading="2. Cancel anytime">
        <p>
          You can cancel at any time from <em>Dashboard → Manage subscription</em>, which opens
          Polar&apos;s secure billing portal. When you cancel, your Pro access continues until the
          end of the current paid month and is then not renewed — <strong>you are not charged again</strong>.
        </p>
        <p>
          Cancelling is <em>not</em> the same as withdrawing (section 3): cancelling stops future
          renewals but does not by itself refund the current period, whereas withdrawing within the
          first {WITHDRAWAL_WINDOW_DAYS} days may refund the unused part of it.
        </p>
      </Section>

      <Section heading={`3. Your ${WITHDRAWAL_WINDOW_DAYS}-day right of withdrawal (with a pro-rata refund)`}>
        <p>
          Because Pro starts immediately, at checkout you expressly ask us to begin the service
          during the withdrawal period and acknowledge the pro-rata rule. You do{" "}
          <strong>not</strong> give up your right to withdraw by doing so — you simply pay only for
          the part of the service you actually use.
        </p>
        <p>
          For <strong>{WITHDRAWAL_WINDOW_DAYS} days</strong> from the start of your subscription you
          may withdraw <strong>for any reason, with no explanation required</strong>:
        </p>
        <ul>
          <li>
            <strong>Self-serve, one click:</strong> open{" "}
            <em>Dashboard → &quot;Withdraw from contract here&quot;</em> (shown throughout the
            {" "}{WITHDRAWAL_WINDOW_DAYS}-day window). Confirming immediately ends your subscription
            and issues your refund automatically through Polar — no email or waiting on us. We then{" "}
            <strong>send you a confirmation of your withdrawal on a durable medium</strong> (and make a
            downloadable record available), so you have lasting proof that you withdrew.
          </li>
          <li>
            <strong>What you get back:</strong> a <strong>pro-rata refund</strong> of the unused
            portion of your current billing month. You remain liable only for the proportionate part
            already provided (EU Consumer Rights Directive Art. 14(3)). The proportion is{" "}
            <strong>calculated on the total price agreed in the contract</strong>; because Pro has{" "}
            <strong>no minimum term</strong>, the only price you have committed to is the current
            month&apos;s &euro;9.99, so we pro-rate against that month — not against any longer or
            annual figure. For example, withdrawing on day 3 of a 30-day month refunds roughly 27/30 of
            the &euro;9.99; you pay only for the ~3 days used.
          </li>
          <li>
            <strong>Prefer email?</strong> You can also withdraw by emailing{" "}
            <strong>{LEGAL.contactEmail}</strong> with your account email and the charge date, and
            we will process it the same way.
          </li>
        </ul>
        <p>
          This {WITHDRAWAL_WINDOW_DAYS}-day withdrawal is available to <strong>every</strong> Pro
          subscriber worldwide. For consumers in the <strong>EU/EEA</strong> it is the statutory
          right of withdrawal. <strong>UK</strong> consumers have equivalent statutory rights under the
          Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, whose
          formal route is <strong>cancellation by a clear notice</strong> (for example, by emailing{" "}
          <strong>{LEGAL.contactEmail}</strong>) within {WITHDRAWAL_WINDOW_DAYS} days; the self-serve{" "}
          <strong>&quot;Withdraw from contract here&quot;</strong> button is offered to UK consumers as
          a convenient way to give that notice, and does not replace or limit your statutory route.
          If we ever failed to capture your express consent or to give you the required pre-contract
          information, you bear no cost for the period before withdrawal.
        </p>
      </Section>

      <Section heading="4. Refunds outside the 14-day window">
        <p>
          After the {WITHDRAWAL_WINDOW_DAYS}-day window, fees for billing months that have already
          elapsed are generally non-refundable — except where the law provides otherwise, including
          where the service was <strong>not provided</strong> or was <strong>materially defective</strong>
          {" "}(you may then be entitled to a repair, price reduction, or refund under the EU Digital
          Content/Services Directive 2019/770 or the UK Consumer Rights Act 2015), or where you were{" "}
          <strong>charged in error</strong> (for example, billed after cancelling). Email{" "}
          <strong>{LEGAL.contactEmail}</strong> and we will look into it in good faith and, where
          appropriate, issue a full or partial refund through Polar.
        </p>
      </Section>

      <Section heading="5. How refunds are paid">
        <p>
          All refunds — statutory, pro-rata, or goodwill — are issued by <strong>Polar</strong>, our
          Merchant of Record, back to the <strong>original payment method</strong> used at checkout.
          They normally appear within <strong>5–10 business days</strong> of being issued, depending
          on your bank or card provider. We never see or store your full card details; Polar handles
          the payment and the refund.
        </p>
      </Section>

      <Section heading="6. Renewals, receipts, and failed payments">
        <p>
          Your next renewal date is always shown in <em>Dashboard → Manage subscription</em>. Polar,
          as seller of record, emails your purchase confirmation and a receipt for each payment. If a
          renewal payment fails, we may retry it and/or pause Pro access until payment succeeds. If
          you believe a charge is an error, please contact us at <strong>{LEGAL.contactEmail}</strong>{" "}
          <strong>before</strong> starting a chargeback so we can resolve it quickly.
        </p>
      </Section>

      <Section heading="7. Checkout disclosures and your confirmation">
        <p>
          The pre-contract information required of a trader — including a clear{" "}
          <strong>order-button label</strong> that makes plain you are placing an order with an
          obligation to pay (EU Consumer Rights Directive Art. 8(2)) and a{" "}
          <strong>confirmation of the contract on a durable medium</strong> after you order
          (Art. 8(7)) — is presented to you at <strong>Polar&apos;s checkout</strong>, which Polar
          renders as our Merchant of Record. These remain <strong>{LEGAL.businessName}&apos;s
          responsibility as the trader</strong>; we verify that Polar&apos;s checkout meets them and,
          where anything is missing, we provide a <strong>first-party confirmation</strong> (by email
          and as a downloadable record) so you always receive the required information.
        </p>
      </Section>

      <Section heading="8. Price changes">
        <p>
          We may change the subscription price. Any change applies only to <strong>future</strong>{" "}
          billing periods, and we will give you <strong>at least 7 days&apos; advance notice</strong>{" "}
          (sent by Polar to your checkout email) before it takes effect, so you can cancel if you do
          not agree.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          Billing &amp; refund questions: <strong>{LEGAL.contactEmail}</strong> —{" "}
          <strong>{LEGAL.businessName}</strong>, {LEGAL.businessForm} (operated by{" "}
          {LEGAL.operatorName}, {LEGAL.city}, {LEGAL.country}). Merchant of Record / payment
          processor: <strong>{LEGAL.morEntity}</strong> (<a href={LEGAL.morSite}>polar.sh</a>).
        </p>
      </Section>
    </LegalLayout>
  );
}
