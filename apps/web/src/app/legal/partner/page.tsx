import type { Metadata } from "next";
import LegalLayout, { type LegalSection } from "../legal-layout";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Partner With ScholarHub",
  description:
    "Information for universities, scholarship providers, educators, and student communities interested in working with ScholarHub.",
  alternates: { canonical: `${SITE_URL}/legal/partner` },
  openGraph: {
    title: "Partner With ScholarHub",
    description:
      "Explore potential collaboration around scholarship information and student application planning.",
    url: `${SITE_URL}/legal/partner`,
    type: "website",
  },
};

const sections: LegalSection[] = [
  {
    id: "opportunities",
    title: "Potential collaboration",
    body: (
      <p>
        ScholarHub is being developed to help students discover opportunities
        and organise their applications. Potential collaboration may include
        official scholarship information, university programme data, student
        advising, accessibility feedback, and corrections to published records.
      </p>
    ),
  },
  {
    id: "review",
    title: "Information quality",
    body: (
      <p>
        Partnership does not automatically make a scholarship or organisation
        verified. Material facts must retain source evidence, and any submitted
        catalogue changes are subject to review before publication.
      </p>
    ),
  },
];

export default function PartnerPage() {
  return (
    <LegalLayout
      kicker="Collaboration"
      title="Partner With ScholarHub"
      intro={
        <p>
          We welcome conversations with universities, scholarship providers,
          education advisers, and student communities that can help improve the
          quality and usefulness of scholarship information.
        </p>
      }
      sections={sections}
      contact={
        SUPPORT_EMAIL ? (
          <p>
            For partnership enquiries, email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        ) : (
          <p>
            Partnership contact details will be published after the ScholarHub
            operator and support channels are configured.
          </p>
        )
      }
    />
  );
}
