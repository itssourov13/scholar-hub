import type { Metadata } from "next";
import HomeClient from "./home-client";
import { alternatesFor } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

export const metadata: Metadata = {
  title: "Find International Scholarships for Bangladeshi Students",
  description:
    "Discover curated international scholarship opportunities for students from Bangladesh. Compare official-source-linked eligibility, funding, and application timelines.",
  // Self-canonical (English, unprefixed) + reciprocal hreflang to /bn + x-default.
  alternates: alternatesFor("/", "en"),
  openGraph: {
    title: "Find International Scholarships for Bangladeshi Students | ScholarHub",
    description:
      "Explore curated international scholarship opportunities with source-linked eligibility, funding details, and application timelines for students from Bangladesh.",
    url: BASE_URL,
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ScholarHub — International Scholarships for Bangladeshi Students",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find International Scholarships for Bangladeshi Students",
    description:
      "Explore curated scholarship opportunities with source-linked eligibility and funding details for students from Bangladesh.",
    images: ["/og-image.png"],
  },
};

export default function HomePage() {
  return <HomeClient />;
}
