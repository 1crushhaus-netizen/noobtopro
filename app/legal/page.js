import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Legal & Policies",
  description:
    "All of noobtopro's legal documents and policies in one place: privacy, terms, refunds, cookies, acceptable use, accessibility, billing, AI transparency, sub-processors, data retention, and the legal notice.",
  alternates: { canonical: "/legal" },
};

const GROUPS = [
  {
    heading: "Using noobtopro",
    items: [
      ["/terms", "Terms of Service", "The agreement that governs your use of the Service."],
      ["/aup", "Acceptable Use Policy", "What you may and may not do on noobtopro."],
      ["/accessibility", "Accessibility Statement", "Our accessibility commitment and how to report a barrier."],
      ["/legal/ai-transparency", "AI Transparency Notice", "How AI grades your work — and what the rank is and isn't."],
    ],
  },
  {
    heading: "Privacy & data",
    items: [
      ["/privacy", "Privacy Policy", "What we collect, why, and your privacy rights."],
      ["/cookies", "Cookie & Tracking Policy", "Cookies and analytics, and how to manage your choices."],
      ["/legal/sub-processors", "Sub-processors", "The third parties that help us run the Service."],
      ["/legal/data-retention", "Data Retention & Security", "How long we keep data and how we protect it."],
      ["/legal/us-privacy", "U.S. State Privacy Notice", "Disclosures and rights for U.S. state privacy laws."],
    ],
  },
  {
    heading: "Payments",
    items: [
      ["/legal/billing-terms", "Subscription & Billing Terms", "Pricing, renewals, and the Merchant of Record."],
      ["/refunds", "Refund & Cancellation Policy", "Your 14-day withdrawal right, refunds, and cancelling."],
    ],
  },
  {
    heading: "About the operator",
    items: [
      ["/legal/notice", "Legal Notice (Impressum)", "Who operates noobtopro and the legally required contact details."],
    ],
  },
];

export default function LegalIndexPage() {
  return (
    <LegalLayout title="Legal &amp; Policies">
      <p>
        Everything governing your use of {LEGAL.siteName} ({LEGAL.domainBare}), in one place. For
        anything not answered here, contact us at <strong>{LEGAL.contactEmail}</strong>.
      </p>
      {GROUPS.map((group) => (
        <Section key={group.heading} heading={group.heading}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {group.items.map(([href, label, desc]) => (
              <li key={href} style={{ marginBottom: 14 }}>
                <a href={href} style={{ fontWeight: 600, textDecoration: "none" }}>{label}</a>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>{desc}</div>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </LegalLayout>
  );
}
