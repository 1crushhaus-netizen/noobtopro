# Refund & Cancellation Policy — noobtopro

> **Good-faith policy — not legal advice; independent counsel review recommended before
> launch.** The only outstanding placeholders are the operator's **registered address** and
> **VAT ID**, which are added once the German business registration completes.
>
> **Key legal finding:** Pro is a **digital SERVICE** (CRD Art. 16(a)), not "digital content"
> (Art. 16(m)). So the 14-day right of withdrawal **cannot be fully waived** — the consumer
> keeps it and, if they withdraw within 14 days after asking for immediate access, pays only a
> **pro-rata** amount for use (Art. 14(3)). The Art. 16(a) consent wording in §10A is captured
> at checkout.
>
> **The EU mandatory "Withdraw from contract here" function (Art. 11a CRD, Dir. (EU)
> 2023/2673, applicable 19 June 2026) is implemented** as a one-click, self-serve control in the
> dashboard that immediately terminates the subscription and issues the pro-rata refund through
> Polar (see `app/api/account/withdraw/route.js`).

**Last updated:** 19 June 2026

This policy explains billing, renewals, cancellations, withdrawal rights, and refunds for the
noobtopro **"Pro"** subscription. It supplements our [Terms of Service](/terms) and
[Subscription & Billing Terms](/legal/billing-terms). Pro is **sold and processed by Polar
Software, Inc. ("Polar")** as **Merchant of Record** (the seller of record for the transaction);
**noobtopro** — a sole proprietorship (Einzelunternehmen) under German law, operated by Russell
Rozario, Cologne, Germany — provides the underlying service. **All refunds are issued through
Polar.**

## 1. What you are buying
Pro is a **digital service** giving immediate access to noobtopro's AI-grading features, billed
**monthly** at the price shown at checkout (currently **€9.99/month, inclusive of any applicable
taxes/VAT** — the tax-inclusive total is shown before you pay). It **renews automatically** each
month until you cancel. No minimum term; the only commitment is the current paid month.

## 2. Immediate access and your 14-day right of withdrawal (EU/EEA & UK consumers)
Because Pro is supplied immediately, at checkout you **expressly request immediate access** and
**acknowledge that you will lose your right of withdrawal once the service has been fully
performed** (see the checkout consent text in §10A). Even so:
- You keep a **14-day right of withdrawal** from the day your subscription starts.
- If you withdraw within 14 days **after** access began at your request, you remain liable only
  for a **proportionate (pro-rata) amount** for the part already provided, and we refund the
  remainder. The proportion is **calculated on the total price agreed in the contract** (Art. 14(3));
  because Pro has **no minimum term**, the only committed price is the current month's **€9.99**, so
  we pro-rate against that month — not against any longer/annual figure. Example: withdrawing on
  day 3 of a 30-day month refunds roughly 27/30 of the €9.99.
- **No reason is required.** To withdraw, use the **"Withdraw from contract here"** control in
  your dashboard (available throughout the 14-day period) — confirming it immediately ends the
  subscription and issues the refund through Polar — or email **russellrozario@noobto.pro**, or
  use the model form in Annex A. After you withdraw, **we send you a confirmation of your
  withdrawal on a durable medium** (and make a downloadable record available) as lasting proof.

If we failed to capture your express consent and acknowledgement, or to give you the required
pre-contract information, **you bear no cost** for the period before withdrawal.

UK consumers have equivalent statutory rights under the Consumer Contracts (Information,
Cancellation and Additional Charges) Regulations 2013, whose formal route is **cancellation by a
clear notice** (e.g. by emailing russellrozario@noobto.pro, or via the Annex A form) within 14
days; the self-serve **"Withdraw from contract here"** button is offered to UK consumers as a
**convenience** for giving that notice and does not replace or limit the statutory route. UK
consumers also have quality rights under the Consumer Rights Act 2015.

## 3. The same 14-day withdrawal is offered worldwide
We extend the **same one-click, self-serve 14-day withdrawal with a pro-rata refund** (§2) to
**every** Pro subscriber, regardless of country — not only to EU/EEA/UK consumers exercising a
statutory right. The "Withdraw from contract here" control appears for any subscriber still inside
the 14-day window.

## 4. Renewals and how to cancel
- Your **next renewal date is always shown** in **Dashboard → Manage subscription** (the Polar
  portal). Polar, as seller of record, emails your **purchase confirmation and a receipt** for each
  payment.
- **Cancel anytime in two clicks** from **Dashboard → Manage subscription**, or email
  **russellrozario@noobto.pro**.
- On cancellation, **Pro access continues until the end of the current paid month**, then stops.
  **You are not charged again.** Cancelling is not the same as withdrawing (§2) — withdrawing
  within 14 days may entitle you to a pro-rata refund; cancelling later simply stops future renewals.

## 5. Refunds outside the above
Beyond the 14-day withdrawal (§2–§3), fees for **elapsed** billing periods are generally
non-refundable, except where required by law or where the Service was **not provided** or was
**materially defective** (you may then be entitled to a repair, price reduction, or refund under
the Digital Content/Services Directive (EU) 2019/770 or the UK Consumer Rights Act 2015), or where
you were **charged in error** (e.g. billed after cancelling). We assess such requests in good
faith and, where appropriate, issue a full or partial refund through Polar.

## 6. How refunds are paid
All refunds — statutory, pro-rata, or goodwill — are returned to your **original payment method via
Polar**, normally within **5–10 business days** of being issued (bank/card timing applies). We
never see or store your full card details. Email **russellrozario@noobto.pro** with your account
email and the charge date for any refund question.

## 7. Failed or disputed payments
If a renewal fails, we may retry and/or pause Pro access until payment succeeds. If you think a
charge is an error, contact us **before** starting a chargeback so we can resolve it.

## 8. Price changes
Any price change applies only to **future** billing periods, with **at least 7 days' advance
notice** (sent by Polar to your checkout email) before it takes effect, so you can cancel if you
disagree.

## 9. Contact
Billing & refunds: **russellrozario@noobto.pro** — **noobtopro**, a sole proprietorship
(Einzelunternehmen) under German law, operated by Russell Rozario, Cologne (Köln), North
Rhine-Westphalia, Germany. *Registered address and VAT ID to be added on completion of business
registration.* Merchant of Record / payment processor: **Polar Software, Inc.** (polar.sh).

---

## 10. Checkout consent + confirmation content (implementation)

**A. Checkout consent checkbox (required, unticked, immediately above the pay button):**
> ☐ **I want noobtopro to start my Pro subscription immediately.** I expressly request that the
> service begin now, during the 14-day withdrawal period, and I acknowledge that **I will lose
> my right of withdrawal once the service has been fully performed.** I understand that if I
> withdraw within 14 days after the service has started at my request, I will be charged only a
> proportionate amount for the part of the service I have used. *(Required)*

This exact wording (and a version stamp) is captured and recorded before the Polar session is
created — see `lib/consent.js` (`IMMEDIATE_ACCESS_CONSENT_TEXT`) and `app/api/checkout/route.js`.

**B. Order-button label (CRD Art. 8(2)):** the pay button must read **only** one of
"Subscribe & pay €9.99/month" / "Order with obligation to pay" / "Pay now" — never a neutral
"Continue"/"Confirm" alone. *(Polar renders the checkout — verify the label complies.)*

**C. Mandatory withdrawal function (Art. 11a, from 19 June 2026):** implemented as a prominent,
always-available **"Withdraw from contract here"** control during the 14-day period → short
confirm dialog → **"Confirm withdrawal"** → immediate termination + pro-rata refund via Polar
(`app/api/account/withdraw/route.js`). On withdrawal we send the consumer an **acknowledgement on
a durable medium** (confirmation email + downloadable record) so they have lasting proof of the
withdrawal.

**B/D are the trader's responsibility.** The **order-button label (Art. 8(2))** and the
**post-purchase confirmation on a durable medium (Art. 8(7))** are provided at **Polar's checkout**,
which Polar renders as Merchant of Record — **but compliance remains noobtopro's responsibility as
the trader** (MoR status does not offload it). *Verify Polar's confirmation states: what was bought;
€9.99/month incl. taxes; the monthly auto-renewal date; seller/MoR = Polar Software, Inc.; service
provider = noobtopro; the recorded immediate-access consent; and the 14-day withdrawal right and how
to exercise it. Where anything is missing, provide it via a **first-party confirmation** (email +
downloadable record) as a fallback.*

---

### Annex A — Model withdrawal form
> To: noobtopro (Russell Rozario), russellrozario@noobto.pro
> I/We hereby give notice that I/We withdraw from my/our contract for the noobtopro Pro
> subscription. Ordered on: [date] · Account email: [email] · Name: [name] · Date: [date]

---

### Open questions for counsel
Whether **Polar's checkout** also captures/echoes the Art. 16(a) consent + Art. 8(7) confirmation
on its side, and reliably disburses statutory/pro-rata refunds despite its default "elapsed periods
non-refundable" stance (we issue them via the API regardless) · the operator's registered address
and VAT ID once registered · whether to add a more generous voluntary money-back guarantee beyond
the pro-rata withdrawal. (The EU Digital Fairness Act on subscriptions is **proposed**, late-2026 —
design forward-compatibly.)
