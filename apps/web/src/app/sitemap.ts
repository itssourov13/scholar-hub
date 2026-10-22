import { MetadataRoute } from "next";
import { sql } from "@/utils/db";
import { fetchPublishedDbGuides } from "@/lib/guides-db";
import { languageAlternates, bnUrl } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
      // Reciprocal hreflang cluster for the homepage (en ↔ bn, x-default → en).
      alternates: { languages: languageAlternates("/") },
    },
    {
      // Bangla homepage — the only localized page today. It carries the same
      // hreflang cluster so the pair is reciprocal.
      url: bnUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
      alternates: { languages: languageAlternates("/") },
    },
    {
      url: `${BASE_URL}/scholarships`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/guide`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/legal/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/cookies`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  try {
    const scholarships = await sql`
      SELECT id, slug, updated_at FROM scholarships WHERE status = 'published'
    `;

    // Use slug URL when available; fall back to UUID for unslugified rows
    const scholarshipRoutes: MetadataRoute.Sitemap = scholarships.map((s) => ({
      url: `${BASE_URL}/scholarships/${(s.slug as string | null) ?? (s.id as string)}`,
      lastModified: s.updated_at ? new Date(s.updated_at as string) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const dbGuides = await fetchPublishedDbGuides();
    const dbGuideRoutes: MetadataRoute.Sitemap = dbGuides.map((g) => ({
      url: `${BASE_URL}/guide/${g.slug}`,
      lastModified: g.updatedAt ? new Date(g.updatedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));

    return [...staticRoutes, ...dbGuideRoutes, ...scholarshipRoutes];
  } catch {
    return staticRoutes;
  }
}
