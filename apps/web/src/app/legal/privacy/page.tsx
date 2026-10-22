import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "../legal-layout";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy information for ScholarHub.",
  alternates: { canonical: `${SITE_URL}/legal/privacy` },
};

const sections: LegalSection[] = [
  {
    id: "status",
    title: "Publication status",
    body: (
      <p>
        This page is a pre-release draft. The final policy must accurately
        describe the service operator, personal information collected, purposes
        and legal basis for processing, service providers, storage locations,
        retention periods, transfers, security practices, and available user
        rights. Those details must be confirmed against the deployed
        configuration before ScholarHub is opened to the public.
      </p>
    ),
  },
  {
    id: "data-review",
    title: "Data handling review",
    body: (
      <ul>
        <li>Document all profile, application, chat, usage, and account data collected.</li>
        <li>Identify the authentication, database, object-storage, AI, analytics, and notification providers enabled in production.</li>
        <li>Define how personal files, essays, academic records, and recommendation letters are stored, transmitted, retained, exported, and deleted.</li>
        <li>Explain how account deletion and backups are handled, including any retention exceptions.</li>
        <li>Identify the responsible operator, support contact, and applicable privacy rights for target markets.</li>
      </ul>
    ),
  },
  {
    id: "sensitive-documents",
    title: "Sensitive documents",
    body: (
      <p>
        Do not upload sensitive personal documents to a development deployment.
        Cloud document storage and third-party AI processing must remain disabled
        until the actual providers, data flows, user consent, access controls,
        retention, and deletion behaviour have been reviewed and documented.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      kicker="Legal draft"
      title="Privacy Policy"
      intro={
        <p>
          This draft is retained to make the publication blocker explicit. It is
          not a final privacy notice and should not be treated as one.
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
            A responsible operator and support contact have not yet been
            configured for this development deployment.
          </p>
        )
      }
    />
  );
}
