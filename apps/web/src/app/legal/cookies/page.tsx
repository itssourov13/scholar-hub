import type { Metadata } from "next";
import LegalLayout, { type LegalSection } from "../legal-layout";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Cookie and local-storage information for ScholarHub.",
  alternates: { canonical: `${SITE_URL}/legal/cookies` },
};

const sections: LegalSection[] = [
  {
    id: "status",
    title: "Publication status",
    body: (
      <p>
        This is a pre-release draft. The actual production configuration must be
        checked before this page is finalised, including analytics, advertising,
        authentication, consent storage, and any third-party scripts.
      </p>
    ),
  },
  {
    id: "local-storage",
    title: "Local storage and preferences",
    body: (
      <p>
        The current web client stores a cookie-consent choice in browser
        localStorage. That browser storage is not itself a cookie, and it can be
        cleared by the user through browser settings. Other essential storage
        may be used for authentication and application operation; the final
        policy must enumerate the actual items and purposes.
      </p>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party tags",
    body: (
      <p>
        Optional analytics or advertising integrations must remain disabled
        unless their owner, identifiers, data flows, consent behaviour, and
        retention are verified and accurately disclosed here. Deployment
        configuration can change which integrations are active, so review the
        production environment before release.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      kicker="Legal draft"
      title="Cookie Policy"
      intro={
        <p>
          This draft describes the current consent preference behaviour and
          identifies the configuration details that still require review. It is
          not a final cookie notice.
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
          <p>Support contact details have not yet been configured.</p>
        )
      }
    />
  );
}
