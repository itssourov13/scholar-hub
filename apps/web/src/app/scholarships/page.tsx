import type { Metadata } from "next";
import ScholarshipsClient from "./scholarships-client";
import ScholarshipDirectory from "./scholarship-directory";
import SharedFooter from "@/components/layout/shared-footer";
import styles from "./scholarships.module.css";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

// On-demand ISR: the crawlable directory is static until an admin mutation
// calls revalidateScholarshipPages (publish / edit / archive / thumbnail).
export const revalidate = false;

export const metadata: Metadata = {
  title: "International Scholarships for Bangladeshi Students",
  description:
    "Browse 300+ international scholarships for students from Bangladesh. Filter by country, degree level, funding type, and deadline. Includes fully funded, no-IELTS, Masters, PhD, and Bachelors opportunities.",
  alternates: {
    canonical: `${BASE_URL}/scholarships`,
  },
  openGraph: {
    title: "International Scholarships for Bangladeshi Students | ScholarHub",
    description:
      "Find Masters, PhD, and Bachelors scholarships in the UK, USA, Germany, Canada, and more — curated and AI-summarised for students from Bangladesh.",
    url: `${BASE_URL}/scholarships`,
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ScholarHub — Scholarships for Bangladeshi Students",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "International Scholarships for Bangladeshi Students",
    description:
      "Browse 300+ international scholarships with AI-powered eligibility summaries. Built for students from Bangladesh.",
    images: ["/og-image.png"],
  },
};

export default function ScholarshipsPage() {
  return (
    <>
      <ScholarshipsClient />
      {/* Server-rendered crawlable index of every scholarship (see component). */}
      {/* Same side gutters as the client page wrapper above, so the directory
          and footer line up with the card grid instead of hugging the edges. */}
      <div className={styles.pageTail}>
        <ScholarshipDirectory />
        <SharedFooter />
      </div>
    </>
  );
}
