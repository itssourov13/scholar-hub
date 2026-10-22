import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "../legal-layout";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using ScholarHub.",
  alternates: { canonical: `${SITE_URL}/legal/terms` },
};

const sections: LegalSection[] = [
  {
    id: "status",
    title: "Publication status",
    body: (
      <p>
        These terms are a pre-release draft, not a binding or final agreement.
        The operator must review and publish terms that match the actual
        ScholarHub service, jurisdiction, supported users, fees (if any), and
        applicable law before public launch.
      </p>
    ),
  },
  {
    id: "service",
    title: "Service scope to define",
    body: (
      <ul>
        <li>Supported features, availability, user eligibility, and account requirements.</li>
        <li>How public scholarship records are sourced, reviewed, corrected, and archived.</li>
        <li>The limitations of eligibility summaries, funding comparisons, and AI-generated guidance.</li>
        <li>Rules for acceptable use, user-submitted content, intellectual property, and third-party links.</li>
        <li>Account suspension, data export/deletion, warranty disclaimers, liability limits, dispute handling, and governing law.</li>
      </ul>
    ),
  },
  {
    id: "official-decisions",
    title: "Scholarship and admissions decisions",
    body: (
      <p>
        ScholarHub is a research and planning tool. It does not award
        scholarships or make admissions, visa, immigration, or financial-aid
        decisions. Users must confirm material requirements and deadlines with
        the relevant official institution or scholarship provider.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      kicker="Legal draft"
      title="Terms of Service"
      intro={
        <p>
          This page records the terms that must be finalised before the service
          can be offered publicly. It is not the final agreement.
        </p>
      }
      sections={sections}
      contact={
        SUPPORT_EMAIL ? (
          <p>
            Configured support contact:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        ) : (
          <p>
            Operator and support details are not configured for this
            development deployment.
          </p>
        )
      }
    />
  );
}
