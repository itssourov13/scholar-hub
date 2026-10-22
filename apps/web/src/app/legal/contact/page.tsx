import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "../legal-layout";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact ScholarHub",
  description: "Find support and feedback contact information for ScholarHub.",
  alternates: { canonical: `${SITE_URL}/legal/contact` },
};

const sections: LegalSection[] = [
  {
    id: "contact",
    title: "Support contact",
    body: SUPPORT_EMAIL ? (
      <p>
        For support, feedback, or scholarship-record corrections, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        Do not include passwords or unnecessary sensitive documents in support
        messages.
      </p>
    ) : (
      <p>
        A support email has not been configured for this development build.
        Configure the ScholarHub support contact before making the service
        publicly available.
      </p>
    ),
  },
  {
    id: "corrections",
    title: "Reporting scholarship information",
    body: (
      <p>
        When reporting a possible error, include the opportunity name and its
        official source URL. Deadlines, nationality eligibility, test
        requirements, and funding changes need to be checked against an official
        source before the catalogue is updated.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "Privacy and account requests",
    body: (
      <p>
        Use the Privacy Policy and Delete Account pages for information about
        personal-data handling. Those policies and the responsible operator
        contact must be reviewed against the final deployment before public
        release.
      </p>
    ),
  },
];

export default function ContactPage() {
  return (
    <LegalLayout
      kicker="Support"
      title="Contact ScholarHub"
      intro={
        <p>
          Use the configured support channel for product feedback, suspected
          scholarship-data errors, account questions, or accessibility issues.
        </p>
      }
      sections={sections}
      contact={
        SUPPORT_EMAIL ? (
          <p>
            Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        ) : (
          <p>
            Support contact details are not configured for this development
            build and must be set before public release.
          </p>
        )
      }
    />
  );
}
