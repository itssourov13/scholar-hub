import type { Metadata } from "next";
import HomeClient from "../home-client";
import { alternatesFor, bnUrl } from "@/lib/i18n";

// Bangla homepage. Reuses the same HomeClient as the English home — the /bn
// layout forces the language to Bangla, so the entire page renders in Bangla
// on the server. Metadata (title/description) is authored in Bangla and the
// canonical + hreflang are locale-correct.
export const metadata: Metadata = {
  title: "বিদেশে স্কলারশিপ খুঁজুন — বাংলাদেশি শিক্ষার্থীদের জন্য",
  description:
    "বাংলাদেশি শিক্ষার্থীদের জন্য ৩০০+ ফুল ও পার্শিয়াল ফান্ডেড আন্তর্জাতিক স্কলারশিপ। যুক্তরাজ্য, যুক্তরাষ্ট্র, জার্মানি, কানাডাসহ নানা দেশে মাস্টার্স, পিএইচডি ও ব্যাচেলর সুযোগ — AI-চালিত যোগ্যতা বিশ্লেষণসহ।",
  alternates: alternatesFor("/", "bn"),
  openGraph: {
    title: "বিদেশে স্কলারশিপ খুঁজুন — বাংলাদেশি শিক্ষার্থীদের জন্য | ScholarHub",
    description:
      "বাংলাদেশি শিক্ষার্থীদের জন্য AI-চালিত স্কলারশিপ অনুসন্ধান। ৩০+ দেশে ৩০০+ সুযোগ, যোগ্যতা বিশ্লেষণ ও আবেদনের টাইমলাইনসহ।",
    url: bnUrl("/"),
    type: "website",
    locale: "bn_BD",
    alternateLocale: ["en_US"],
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ScholarHub — বাংলাদেশি শিক্ষার্থীদের জন্য আন্তর্জাতিক স্কলারশিপ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "বিদেশে স্কলারশিপ খুঁজুন — বাংলাদেশি শিক্ষার্থীদের জন্য",
    description:
      "বাংলাদেশি শিক্ষার্থীদের জন্য AI-চালিত স্কলারশিপ অনুসন্ধান। ৩০০+ সুযোগ, যোগ্যতা বিশ্লেষণসহ।",
    images: ["/og-image.png"],
  },
};

export default function BanglaHomePage() {
  return <HomeClient />;
}
