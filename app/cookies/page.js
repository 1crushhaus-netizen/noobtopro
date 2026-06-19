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
            preferences such as your theme, and recording your own analytics choice (the consent
            record). These do not require consent, but we disclose them below.
          </li>
          <li>
            <strong>Analytics (off until you opt in).</strong> Privacy-friendly analytics that help
            us understand how the site is used and improve it. They load <strong>only after you
            accept</strong> (see &quot;Your choices&quot; below).
          </li>
          <li>
            <strong>Marketing / advertising.</strong> We do <strong>not</strong> use advertising or
            cross-site tracking cookies.
          </li>
        </ul>
        <p>
          Importantly, the legal test is whether something is <strong>stored on or read from your
          device</strong> &mdash; not whether it sets a traditional &ldquo;cookie&rdquo;. A tool
          described as &ldquo;cookieless&rdquo; can still read or write{" "}
          <code>localStorage</code> or other device storage, so <strong>&ldquo;cookieless&rdquo; does
          not mean exempt from consent</strong>. We treat all three analytics tools below as
          consent-required for that reason.
        </p>
      </Section>

      <Section heading="2. Strictly-necessary storage (no consent needed)">
        <p>
          We set the following before any consent because the Service cannot function without it. We
          disclose it here for transparency:
        </p>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Stored / accessed on device</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase authentication</td>
              <td>Supabase, Inc.</td>
              <td>Keeps you signed in and secures your session</td>
              <td>Auth tokens in <code>localStorage</code></td>
              <td>Until you sign out or the session expires</td>
            </tr>
            <tr>
              <td>Consent record</td>
              <td>{LEGAL.siteName} (first-party)</td>
              <td>
                Remembers your analytics choice so we don&rsquo;t re-ask and don&rsquo;t load
                analytics without consent
              </td>
              <td>
                <code>noobtopro:consent</code> (&ldquo;granted&rdquo;/&ldquo;denied&rdquo;) in{" "}
                <code>localStorage</code>
              </td>
              <td>Persistent until you change it or clear storage</td>
            </tr>
            <tr>
              <td>Theme preference</td>
              <td>{LEGAL.siteName} (first-party)</td>
              <td>Remembers your light/dark theme</td>
              <td>Theme value in <code>localStorage</code></td>
              <td>Persistent until you change it or clear storage</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section heading="3. Analytics technologies (consent-required)">
        <p>
          These load <strong>only after you opt in</strong>, and never for visitors who decline.
          Each reads or writes information on your device, so each requires your consent:
        </p>
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Stored / accessed on device</th>
              <th>Data collected</th>
              <th>Retention</th>
              <th>Transfer</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vercel Web Analytics</td>
              <td>Vercel, Inc. (USA)</td>
              <td>Aggregate, privacy-friendly page-view analytics; no cross-site tracking</td>
              <td>
                Loads a script that reads/writes <code>localStorage</code> (e.g. the{" "}
                <code>va-disable</code> flag); no advertising cookies
              </td>
              <td>Aggregated page views, referrer, approximate location, device/browser type</td>
              <td>Aggregated; retained per Vercel&rsquo;s analytics terms</td>
              <td>
                United States &mdash; EU&ndash;US Data Privacy Framework (SCCs as a fallback)
              </td>
            </tr>
            <tr>
              <td>Vercel Speed Insights</td>
              <td>Vercel, Inc. (USA)</td>
              <td>Anonymous performance measurement (load times, responsiveness)</td>
              <td>Sends performance beacons; may read/write <code>localStorage</code></td>
              <td>Page-performance metrics and a transient device/route identifier</td>
              <td>Aggregated; retained per Vercel&rsquo;s analytics terms</td>
              <td>
                United States &mdash; EU&ndash;US Data Privacy Framework (SCCs as a fallback)
              </td>
            </tr>
            <tr>
              <td>Ahrefs Web Analytics</td>
              <td>Ahrefs Pte. Ltd. (Singapore)</td>
              <td>Privacy-friendly, &ldquo;cookieless&rdquo; traffic analytics</td>
              <td>
                Loads a third-party script (<code>analytics.ahrefs.com</code>) that can read/write{" "}
                <code>localStorage</code>; &ldquo;cookieless&rdquo; &ne; no device access
              </td>
              <td>Aggregated traffic metrics; a daily salted hash of IP + user-agent</td>
              <td>Aggregated; retained per Ahrefs&rsquo; terms</td>
              <td>
                United States (AWS) &mdash; Standard Contractual Clauses + Transfer Impact Assessment
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section heading="4. Your choices">
        <p>
          For everything <strong>except strictly necessary</strong> technologies we ask for your{" "}
          <strong>prior, freely given, specific, informed consent</strong> before they run. Analytics
          is a <strong>single choice</strong>: when you first visit, a banner lets you{" "}
          <strong>Accept</strong> or <strong>Reject</strong> all analytics together. Rejecting is{" "}
          <strong>as easy as accepting</strong>, and refusing analytics does <strong>not</strong>{" "}
          reduce your access to the free or Pro tiers.
        </p>
        <p>
          You can change or withdraw your choice at any time through <strong>&quot;Cookie
          preferences&quot;</strong> &mdash; available in the site footer and within the app &mdash;
          which reopens the banner so you can switch your choice; withdrawal is as easy as giving
          consent. We also honor the <strong>Global Privacy Control (GPC)</strong> browser signal as
          an opt-out — if your browser sends it, analytics stays off without you having to do anything.
        </p>
        <p>
          You can additionally block or delete storage through your browser settings, though blocking
          strictly-necessary storage may prevent you from signing in.
        </p>
      </Section>

      <Section heading="5. International transfers">
        <p>
          Our analytics providers process data outside the EU/EEA, in the United States. Where that
          happens we rely on appropriate safeguards: the <strong>EU&ndash;US Data Privacy
          Framework</strong> for Vercel, and the EU <strong>Standard Contractual Clauses</strong>{" "}
          (with a Transfer Impact Assessment) for Ahrefs. See our{" "}
          <a href="/legal/sub-processors">Sub-processors</a> list and{" "}
          <a href="/privacy">Privacy Policy</a> for more.
        </p>
      </Section>

      <Section heading="6. Changes to this Policy">
        <p>
          We may update this Policy as our technologies or the law change. We will revise the
          &quot;Last updated&quot; date and, for material changes, ask for your consent again.
        </p>
      </Section>

      <Section heading="7. Contact">
        <p>
          Questions about this Policy: <strong>{LEGAL.contactEmail}</strong> — {LEGAL.businessName},{" "}
          {LEGAL.city}, {LEGAL.country}.
        </p>
      </Section>
    </LegalLayout>
  );
}
