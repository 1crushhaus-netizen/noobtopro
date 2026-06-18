import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Legal Notice (Impressum)",
  description:
    "Legal notice / Impressum for noobtopro: the service provider, contact details, and the points of contact required under German law (§ 5 DDG) and the EU e-Commerce and Digital Services rules.",
  alternates: { canonical: "/legal/notice" },
};

export default function LegalNoticePage() {
  return (
    <LegalLayout
      title="Legal Notice (Impressum)"
      note={
        <>
          <strong style={{ color: "var(--text)" }}>{LEGAL.businessName}</strong> is a newly
          established {LEGAL.businessForm}. The registered business address and any
          register/VAT details are being finalized and will be added here as soon as they are
          available; in the meantime, the email below reaches the operator directly.
        </>
      }
    >
      <p>
        Information pursuant to § 5 of the German Digital Services Act (Digitale-Dienste-Gesetz,
        DDG) and Article 5 of the EU e-Commerce Directive (2000/31/EC).
      </p>

      <Section heading="Service provider">
        <p>
          {LEGAL.businessName} — operated by <strong>{LEGAL.operatorName}</strong> as a{" "}
          {LEGAL.businessForm}.
          <br />
          {LEGAL.address}
          <br />
          {LEGAL.city}, {LEGAL.region}, {LEGAL.country}
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Email: <strong>{LEGAL.contactEmail}</strong>
          <br />
          All business and support communications are handled at this address; we aim to enable
          rapid, direct electronic contact.
        </p>
      </Section>

      <Section heading="Register and VAT">
        <p>{LEGAL.registrationNote}</p>
        <p>VAT: {LEGAL.vatId}</p>
      </Section>

      <Section heading="Responsible for content">
        <p>
          {LEGAL.operatorName}, at the address above (responsible for the content of this website
          within the meaning of the applicable German media law).
        </p>
      </Section>

      <Section heading="Digital Services Act — points of contact">
        <p>
          Under Regulation (EU) 2022/2065 (Digital Services Act):
        </p>
        <ul>
          <li>
            <strong>Point of contact for users (Art. 12)</strong> and{" "}
            <strong>for authorities, the Commission, and the Board (Art. 11)</strong>: contact us
            electronically at <strong>{LEGAL.contactEmail}</strong>. Messages are handled by a
            person, not solely by automated means. Communication language: English.
          </li>
          <li>
            No legal representative under Art. 13 is required, as the provider is established in
            the European Union.
          </li>
        </ul>
      </Section>

      <Section heading="Reporting illegal content (DSA Art. 16)">
        <p>
          You can report content you consider illegal — including alleged copyright infringement —
          by emailing <strong>{LEGAL.contactEmail}</strong>. A useful notice includes: a clear
          explanation of why the content is illegal, the exact location (URL) of the content, your
          name and email, and a good-faith statement that your report is accurate. We confirm
          receipt, review diligently, inform you of our decision, and provide a statement of reasons
          where we remove or restrict content (Art. 17). See also our{" "}
          <a href="/aup">Acceptable Use Policy</a>.
        </p>
      </Section>

      <Section heading="Consumer dispute resolution">
        <p>
          We are not obliged to, and do not currently commit to, participate in dispute-resolution
          proceedings before a consumer arbitration board. EU consumers can find help through their
          national consumer authority or the European Consumer Centres Network (
          <a href="https://www.eccnet.eu" target="_blank" rel="noopener noreferrer">eccnet.eu</a>).
        </p>
      </Section>

      <Section heading="Payments">
        <p>
          Purchases of Pro are sold and processed by <strong>{LEGAL.mor}</strong> ({LEGAL.morEntity}),
          acting as <strong>Merchant of Record</strong> (the seller of record); {LEGAL.businessName}{" "}
          provides the service. See our <a href="/legal/billing-terms">Subscription &amp; Billing
          Terms</a> and <a href="/refunds">Refund &amp; Cancellation Policy</a>.
        </p>
      </Section>

      <Section heading="Supervisory authority (data protection)">
        <p>
          For data-protection matters, the competent lead supervisory authority is the{" "}
          {LEGAL.supervisoryAuthority}. See our <a href="/privacy">Privacy Policy</a> for how we
          handle personal data.
        </p>
      </Section>
    </LegalLayout>
  );
}
