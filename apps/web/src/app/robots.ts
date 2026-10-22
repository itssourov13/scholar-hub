import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/scholarships", "/scholarships/", "/guide", "/guide/", "/legal/"],
        disallow: [
          "/admin/",
          "/chat/",
          "/api/",
          "/auth/",
          "/dashboard/",
          "/profile/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
