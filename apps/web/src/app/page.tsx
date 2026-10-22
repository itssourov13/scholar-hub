import type { Metadata } from "next";
import HomeClient from "./home-client";
import { alternatesFor } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

export const metadata: Metadata = {
  title: "Find International Scholarships for Bangladeshi Students",
  description:
    "Discover 300+ fully funded and partial scholarships for students from Bangladesh. Browse Masters, PhD, and Bachelors opportunities in the UK, USA, Germany, Canada, and more — with AI-powered eligibility summaries.",
  // Self-canonical (English, unprefixed) + reciprocal hreflang to /bn + x-default.
  alternates: alternatesFor("/", "en"),
  openGraph: {
    title: "Find International Scholarships for Bangladeshi Students | ScholarHub",
    description:
      "AI-powered scholarship discovery for students from Bangladesh. Browse 300+ opportunities across 30+ countries with eligibility breakdowns and application timelines.",
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
      "AI-powered scholarship discovery for students from Bangladesh. Browse 300+ opportunities with eligibility breakdowns.",
    images: ["/og-image.png"],
  },
};

export default function HomePage() {
  return <HomeClient />;
}
