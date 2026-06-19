import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Cookie Policy",
  description:
    "How noobtopro uses cookies and similar technologies (browser storage, beacons, analytics) — what is strictly necessary, what needs your consent, and how to manage your choices.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookie &amp; Tracking Technologies Policy">
      <p>
        This Cookie Policy explains how {LEGAL.siteName} ({LEGAL.domainBare}) uses cookies and{" "}
        <strong>similar technologies</strong> — including browser <code>localStorage</code>, beacons,
        and device/network identifiers — and the choices you have. It supplements our{" "}
        <a href="/privacy">Privacy Policy</a>. The legal test is the act of <strong>storing or
        accessing information on your device</strong>, not the label &quot;cookie&quot;, and it applies{" "}
        <strong>whether or not</strong> the information is personal data.
      </p>

      <Section heading="1. The categories we use">
        <ul>
          <li>
            <strong>Strictly necessary (always on).</strong> A small amount of browser storage we
            need to run the Service — keeping you signed in (Supabase authentication), remembering
            preferences such as your theme, and recording your own cookie choice. These do not
            require consent, but we disclose them here.
          </li>
          <li>
            <strong>Performance &amp; analytics (off until you opt in).</strong> Privacy-friendly
            analytics that help us understand how the site is used and improve it. They load{" "}
            <strong>only after you accept</strong> (see &quot;Your choices&quot; below).
          </li>
          <li>
            <strong>Marketing / advertising.</strong> We do <strong>not</strong> use advertising or
            cross-site tracking cookies.
          </li>
        </ul>
      </Section>

      <Section heading="2. The analytics technologies (consent-required)">
        <p>These load only after you opt in, and never for visitors who decline:</p>
        <ul>
          <li>
            <strong>Vercel Web Analytics</strong> — aggregate, privacy-friendly page-view analytics.
            No advertising cookies; no cross-site tracking.
          </li>
          <li>
            <strong>Vercel Speed Insights</strong> — anonymous performance measurement (load times,
            responsiveness) so we can keep the site fast.
          </li>
          <li>
            <strong>Ahrefs Web Analytics</strong> — cookieless, privacy-friendly traffic analytics.
            Note that Ahrefs may process data outside the EU/EEA (see &quot;International
            transfers&quot;).
          </li>
        </ul>
      </Section>

      <Section heading="3. Your choices">
        <p>
          For everything <strong>except strictly necessary</strong> technologies we ask for your{" "}
          <strong>prior, freely given, specific, informed consent</strong> before they run. When you
          first visit, a banner lets you <strong>Accept</strong> or <strong>Reject</strong> — rejecting
          is <strong>as easy as accepting</strong>, and refusing non-essential analytics does{" "}
          <strong>not</strong> reduce your access to the free or Pro tiers.
        </p>
        <p>
          You can change or withdraw your choice at any time through <strong>&quot;Cookie
          preferences&quot;</strong> in the site footer; withdrawal is as easy as giving consent. We
          also honor the <strong>Global Privacy Control (GPC)</strong> browser signal as an opt-out —
          if your browser sends it, non-essential analytics stay off without you having to do anything.
        </p>
        <p>
          You can additionally block or delete storage through your browser settings, though blocking
          strictly-necessary storage may prevent you from signing in.
        </p>
      </Section>

      <Section heading="4. International transfers">
        <p>
          Some analytics providers may process data outside the EU/EEA, including in the United States.
          Where that happens we rely on appropriate safeguards (such as the EU&nbsp;Standard Contractual
          Clauses and, where applicable, the EU–US Data Privacy Framework). See our{" "}
          <a href="/legal/sub-processors">Sub-processors</a> list and{" "}
          <a href="/privacy">Privacy Policy</a> for more.
        </p>
      </Section>

      <Section heading="5. Changes to this Policy">
        <p>
          We may update this Policy as our technologies or the law change. We will revise the
          &quot;Last updated&quot; date and, for material changes, ask for your consent again.
        </p>
      </Section>

      <Section heading="6. Contact">
        <p>
          Questions about this Policy: <strong>{LEGAL.contactEmail}</strong> — {LEGAL.businessName},{" "}
          {LEGAL.city}, {LEGAL.country}.
        </p>
      </Section>
    </LegalLayout>
  );
}
