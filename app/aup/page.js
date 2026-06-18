import LegalLayout, { Section } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Acceptable Use Policy",
  description:
    "The rules for using noobtopro responsibly — what you may not do, how we enforce these rules, and how to report abuse, illegal content, or security issues. noobtopro is an adults-only (18+) service.",
  alternates: { canonical: "/aup" },
};

export default function AcceptableUsePage() {
  return (
    <LegalLayout title="Acceptable Use Policy">
      <p>
        This Acceptable Use Policy (the &quot;AUP&quot;) governs your use of {LEGAL.siteName} (the
        &quot;Service&quot;), operated by {LEGAL.businessName}, a {LEGAL.businessForm} based in{" "}
        {LEGAL.city}, {LEGAL.country}. By using the Service you agree to this AUP. It forms part of,
        and is incorporated into, our <a href="/terms">Terms of Service</a>, and we may update it
        with notice as set out in the Terms.
      </p>
      <p>
        {LEGAL.siteName} is an <strong>adults-only service</strong>: you must be{" "}
        <strong>18 or older</strong> to create an account or use the Service.
      </p>

      <Section heading="1. You agree not to">
        <ul>
          <li>
            <strong>Game or attack the system.</strong> Manipulate, reverse-engineer, defeat, or
            probe the scoring, ranking, rate-limiting, anti-abuse, question-token, or entitlement
            systems; or submit prompt-injection or other content intended to subvert grading.
          </li>
          <li>
            <strong>Misrepresent the rank.</strong> Present a {LEGAL.siteName} rank as an official
            credential, exam result, or qualification, or share it as such.
          </li>
          <li>
            <strong>Abuse the infrastructure.</strong> Scrape, scan, overload, rate-flood, or
            disrupt the Service or its providers; access it by automated means except as we
            expressly permit; or circumvent access controls or attempt to reach another
            user&apos;s data.
          </li>
          <li>
            <strong>Submit unlawful or harmful content.</strong> Anything unlawful, infringing,
            defamatory, harassing, hateful, sexual, violent, self-harm-related, or otherwise
            harmful; or content containing <strong>personal or sensitive information about another
            person</strong> (do not photograph other people or their identifying details).
          </li>
          <li>
            <strong>Submit others&apos; work as your own</strong> for grading, or use the Service to
            facilitate academic dishonesty represented as an official assessment.
          </li>
          <li>
            <strong>Misuse accounts.</strong> Share, sell, or transfer your account; create accounts
            to evade limits or bans; or use the Service if you are under 18.
          </li>
          <li>
            <strong>Infringe intellectual property.</strong> Copy, distribute, sell, or create
            derivative works from the Service&apos;s software, curriculum, or content except as
            expressly permitted.
          </li>
        </ul>
      </Section>

      <Section heading="2. Enforcement">
        <p>
          We may investigate suspected breaches and take proportionate action, including warning,
          rate-limiting, suspending, or terminating access, removing content (with a statement of
          reasons where required under Article 17 of the EU Digital Services Act), and reporting
          serious unlawful activity to the authorities. We operate a notice-and-action channel for
          illegal content and copyright complaints — see our <a href="/legal/notice">Legal
          Notice</a> or contact us at <strong>{LEGAL.contactEmail}</strong>.
        </p>
      </Section>

      <Section heading="3. Reporting abuse, illegal content, or security issues">
        <p>
          To report abuse or illegal content, or to disclose a security vulnerability, contact{" "}
          <strong>{LEGAL.contactEmail}</strong>. Please describe the issue clearly and include any
          links or details that help us locate and assess it.
        </p>
      </Section>

      <Section heading="4. Contact">
        <p>
          Questions about this AUP: <strong>{LEGAL.contactEmail}</strong> — {LEGAL.businessName},{" "}
          {LEGAL.city}, {LEGAL.country}.
        </p>
      </Section>
    </LegalLayout>
  );
}
