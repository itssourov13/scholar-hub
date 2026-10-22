import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "../legal-layout";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About ScholarHub",
  description:
    "Learn how ScholarHub helps students research scholarship opportunities, compare funding, and organise study-abroad applications.",
  alternates: { canonical: `${SITE_URL}/legal/about` },
};

const sections: LegalSection[] = [
  {
    id: "mission",
    title: "Our purpose",
    body: (
      <>
        <p>
          ScholarHub is a scholarship discovery and application-planning platform.
          It brings opportunity research, eligibility review, funding details,
          deadlines, and personal application tasks into one workspace.
        </p>
        <p>
          The product is being designed for students with different nationalities,
          education systems, study destinations, subjects, degree levels, and
          intake plans. Catalogue coverage will grow over time and is not
          guaranteed to be exhaustive.
        </p>
      </>
    ),
  },
  {
    id: "source-quality",
    title: "Scholarship information",
    body: (
      <p>
        Scholarship requirements, deadlines, and funding conditions can change.
        Use ScholarHub to organise research, then confirm important facts and
        application instructions on the official university, government, or
        scholarship-provider website before taking action. AI-generated summaries
        are assistance, not official decisions or evidence by themselves.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and funding",
    body: (
      <p>
        Eligibility explanations depend on the information available for each
        opportunity and the applicant profile. Missing information may lead to an
        unknown result. A profile-fit or matching score is not a probability of
        admission. Tuition coverage alone does not mean every living or travel
        cost is covered.
      </p>
    ),
  },
  {
    id: "release-status",
    title: "Service details",
    body: (
      <p>
        This ScholarHub build is undergoing product and operational setup. Before
        public release, the service operator, support channels, current data
        processors, retention practices, and applicable policies must be
        confirmed and published. Do not use a development deployment to store
        sensitive documents.
      </p>
    ),
  },
];

export default function AboutPage() {
  return (
    <LegalLayout
      kicker="Platform"
      title="About ScholarHub"
      intro={
        <p>
          ScholarHub helps students make scholarship research and application
          planning more organised, transparent, and manageable.
        </p>
      }
      sections={sections}
      contact={
        <p>
          Support and operator contact details will be published once the
          deployment configuration is finalised.
        </p>
      }
    />
  );
}
