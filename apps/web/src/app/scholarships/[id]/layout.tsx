import type { Metadata } from "next";
import { getScholarshipByIdOrSlug } from "@/lib/scholarships-db";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

const FUNDING_MAP: Record<string, string> = {
  full: "Full funding",
  partial: "Partial funding",
  tuition_only: "Tuition only",
  stipend: "Stipend only",
  other: "Other",
};

const LEVEL_MAP: Record<string, string> = {
  bachelors: "Bachelor's",
  masters: "Master's",
  phd: "PhD",
  postdoc: "Postdoc",
  any: "Any level",
};

/** Truncate at word boundary so meta descriptions don't end mid-word. */
function truncateDescription(text: string, maxLen = 155): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 100 ? `${cut.slice(0, lastSpace)}…` : `${cut}…`;
}

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;

    // Shared, request-memoised fetch — the page component reuses this exact
    // result, so we don't hit Neon twice per render.
    const s = await getScholarshipByIdOrSlug(id);

    if (!s) return { title: "Scholarship Not Found", robots: { index: false, follow: true } };

    const level = LEVEL_MAP[s.degree_level] ?? s.degree_level;
    const funding = FUNDING_MAP[s.funding_type] ?? s.funding_type;

    const rawDescription =
      s.ai_summary ??
      `${level} scholarship in ${s.country} — ${funding}. Get AI-powered eligibility summaries and application tips on ScholarHub.`;
    const description = truncateDescription(rawDescription.replace(/\s+/g, " ").trim());

    // Always use the slug URL as canonical (never the UUID)
    const canonicalId = s.slug ?? id;
    const pageUrl = `${BASE_URL}/scholarships/${canonicalId}`;

    const images = s.thumbnail_url
      ? [{ url: s.thumbnail_url, width: 1200, height: 630, alt: `${s.title} — ${s.country} scholarship` }]
      : [{ url: "/og-image.png", width: 1200, height: 630, alt: "ScholarHub" }];

    return {
      title: `${s.title} (${s.country})`,
      description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title: `${s.title} | Study in ${s.country}`,
        description,
        url: pageUrl,
        type: "article",
        images,
      },
      twitter: {
        card: "summary_large_image",
        title: `${s.title} | ScholarHub`,
        description,
        images: images.map((img) => img.url),
      },
    };
  } catch {
    return { title: "Scholarship | ScholarHub" };
  }
}

export default function ScholarshipDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
