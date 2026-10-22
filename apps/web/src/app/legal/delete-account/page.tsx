import type { Metadata } from "next";
import LegalLayout, { type LegalSection } from "../legal-layout";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Delete Your Account",
  description: "Account deletion information for ScholarHub.",
  alternates: { canonical: `${SITE_URL}/legal/delete-account` },
};

const sections: LegalSection[] = [
  {
    id: "status",
    title: "Deletion process to verify",
    body: (
      <p>
        The account-deletion experience for this ScholarHub deployment must be
        verified before public release. This page does not by itself confirm
        that a deletion request has been received or completed.
      </p>
    ),
  },
  {
    id: "what-to-define",
    title: "What must be documented",
    body: (
      <ul>
        <li>How an authenticated user submits and confirms a deletion request.</li>
        <li>Which profile, application, chat, CV, and uploaded-document records are deleted.</li>
        <li>How third-party storage, scheduled jobs, and backups are handled.</li>
        <li>Which limited records may need to be retained and for how long.</li>
        <li>How a user receives confirmation after the request is completed.</li>
      </ul>
    ),
  },
];

export default function DeleteAccountPage() {
  return (
    <LegalLayout
      kicker="Account"
      title="Delete Your Account"
      intro={
        <p>
          The final deletion workflow and retention rules must be tested against
          the deployed authentication, database, and storage services before
          this page can be considered complete.
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
            A support contact has not been configured for this development
            deployment.
          </p>
        )
      }
    />
  );
}
