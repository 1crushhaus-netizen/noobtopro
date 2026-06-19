// ---------------------------------------------------------------------------
// EU Consumer Rights Directive (CRD) consent + withdrawal-window constants.
//
// Pure data + a couple of pure helpers — safe to import from BOTH the client (to
// render the exact consent text at checkout and to show/hide the "Withdraw from
// contract here" control) and the server (to record the consent version and to
// enforce the 14-day window). No secrets, no I/O.
//
// Legal basis (drafts for counsel review, not legal advice):
//   * Art. 16(a): Pro is a digital SERVICE supplied immediately, so the consumer must
//     EXPRESSLY request that performance begin during the withdrawal period AND
//     acknowledge they lose the right of withdrawal once the service is fully performed.
//     We capture that consent in our checkout dialog and record it before creating the
//     Polar session (see app/api/checkout/route.js).
//   * Art. 14(3): if the consumer withdraws within 14 days AFTER access began at their
//     request, they owe only a PROPORTIONATE (pro-rata) amount for the part used; we
//     refund the remainder (see app/api/account/withdraw/route.js).
//   * Art. 11a (applicable 19 June 2026): a prominent, always-available withdrawal
//     function during the 14-day window, AND a durable-medium acknowledgement of receipt
//     that the trader SENDS after withdrawal (built by withdrawalAcknowledgementText below).
// ---------------------------------------------------------------------------

import { LEGAL } from "@/lib/legal";

// The statutory withdrawal period (calendar days from the start of the contract).
export const WITHDRAWAL_WINDOW_DAYS = 14;

// Bump the VERSION whenever the consent TEXT changes — the version is stored alongside
// each recorded consent so we can always prove exactly which wording the user agreed to.
export const IMMEDIATE_ACCESS_CONSENT_VERSION = "2026-06-18";

// The Art. 16(a) consent the consumer must actively tick (unticked by default) immediately
// above the pay button. Mirrors the wording in legal/refund-and-cancellation-policy.md §10A.
export const IMMEDIATE_ACCESS_CONSENT_TEXT =
  "I want noobtopro to start my Pro subscription immediately. I expressly request that the " +
  "service begin now, during the 14-day withdrawal period, and I acknowledge that I will lose " +
  "my right of withdrawal once the service has been fully performed. I understand that if I " +
  "withdraw within 14 days after the service has started at my request, I will be charged only " +
  "a proportionate amount for the part of the service I have used.";

// Window end = anchor (the recorded consent time / contract start) + 14 days.
// `anchor` is an ISO string or Date; returns a Date, or null when the anchor is unusable.
export function withdrawalWindowEnd(anchor) {
  if (!anchor) return null;
  const start = anchor instanceof Date ? anchor : new Date(anchor);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + WITHDRAWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

// Is `now` still within the 14-day window that started at `anchor`? Pure; the server
// enforces this authoritatively in the withdraw route, the client uses it to show/hide.
export function isWithinWithdrawalWindow(anchor, now = new Date()) {
  const end = withdrawalWindowEnd(anchor);
  if (!end) return false;
  const t = now instanceof Date ? now : new Date(now);
  return t.getTime() <= end.getTime();
}

// Pro-rata refund (Art. 14(3)): the consumer pays for the PART USED of the current paid
// period and is refunded the remainder. Given the net order amount (minor units, before
// taxes), the period [start, end], and `now`, returns the integer minor-unit amount to
// refund. Clamped to [0, netAmount]; a not-yet-elapsed or zero-length period refunds the
// whole net amount (consumer-favorable, and the route caps it at Polar's refundableAmount).
export function proRataRefundMinor(netAmountMinor, periodStart, periodEnd, now = new Date()) {
  const net = Math.max(0, Math.round(Number(netAmountMinor) || 0));
  if (net === 0) return 0;
  const s = (periodStart instanceof Date ? periodStart : new Date(periodStart)).getTime();
  const e = (periodEnd instanceof Date ? periodEnd : new Date(periodEnd)).getTime();
  const t = (now instanceof Date ? now : new Date(now)).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return net; // can't compute → refund all
  const usedFraction = Math.min(1, Math.max(0, (t - s) / (e - s)));
  const refund = Math.round(net * (1 - usedFraction));
  return Math.min(net, Math.max(0, refund));
}

// CRD Art. 11a: after a withdrawal the trader must SEND the consumer, without undue delay, an
// acknowledgement of receipt on a DURABLE MEDIUM containing the content of the withdrawal and the
// date/time of submission. This pure builder produces the plain-text record that the withdraw
// route both emails (lib/email.js) and returns to the client for a downloadable copy. `refund` is
// the route's { status, amountMinor, currency } summary.
export function withdrawalAcknowledgementText({ accountEmail, withdrawnAt, refund } = {}) {
  let refundLine = "Refund: any refundable amount is returned via Polar to your original payment method.";
  if (refund && refund.status === "issued" && Number.isFinite(refund.amountMinor) && refund.amountMinor > 0) {
    const amt = (refund.amountMinor / 100).toFixed(2);
    const cur = (refund.currency || "").toUpperCase();
    refundLine = `Pro-rata refund: ${amt}${cur ? " " + cur : ""} issued to your original payment method via Polar (typically 5–10 business days).`;
  } else if (refund && refund.status === "none") {
    refundLine = "Refund: no refundable remainder for the current period (it was essentially fully used).";
  } else if (refund && refund.status === "pending_manual") {
    refundLine = "Refund: under review; any refundable amount will be returned via Polar.";
  }
  return [
    "noobtopro — Acknowledgement of withdrawal",
    "",
    `Account: ${accountEmail || "(your account)"}`,
    "Contract: noobtopro Pro subscription (€9.99 / month).",
    `Withdrawal received (date & time): ${withdrawnAt || new Date().toISOString()}`,
    "",
    "We confirm receipt of your withdrawal from the noobtopro Pro subscription under your 14-day",
    "right of withdrawal (EU Consumer Rights Directive). Your subscription has been terminated with",
    "immediate effect and you will not be charged again.",
    "",
    refundLine,
    "",
    "This is your durable-medium acknowledgement of receipt (CRD Art. 11a).",
    `Service provider: ${LEGAL.businessName} (${LEGAL.operatorName}, ${LEGAL.city}, ${LEGAL.country}).`,
    `Seller of record (Merchant of Record): ${LEGAL.morEntity}.`,
    `Questions: ${LEGAL.contactEmail}`,
  ].join("\n");
}
