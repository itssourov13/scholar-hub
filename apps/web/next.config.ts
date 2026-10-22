import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const R2_PUBLIC_DOMAIN = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN ?? "";

const CDN_NO_STORE = [
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  // Railway builds from the repo root (`cd apps/web && pnpm build`), so Next
  // would otherwise infer the workspace root from /app/pnpm-lock.yaml and emit
  // font URLs at /media/* instead of /_next/static/media/*. Pin both to this
  // app, matching Vercel's old Root Directory = apps/web.
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
  },
  allowedDevOrigins: ["192.168.0.105"],
  // mammoth is a Node-only library used solely in the CV analysis route.
  // Keep it out of the bundler so it loads natively. (PDF parsing uses unpdf,
  // which is bundler/serverless-friendly and needs no such treatment.)
  serverExternalPackages: ["mammoth"],
  async rewrites() {
    return [
      // Compatibility for stale CSS that requested next/font files at /media/*
      // instead of /_next/static/media/* after the Vercel → Railway move.
      { source: "/media/:path*", destination: "/_next/static/media/:path*" },
    ];
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          ...CDN_NO_STORE,
        ],
      },
      {
        // HTML / RSC / pages. Do not apply to /api/* — those set their own
        // Cache-Control (scholarship catalogue is CDN-cacheable for 5 minutes).
        source: "/((?!api|_next/static|_next/image).*)",
        headers: CDN_NO_STORE,
      },
    ];
  },
  images: {
    // Serve R2 / public assets as-is. Vercel Hobby caps Image Optimization at
    // 5,000 transformations/month; next/image would burn that on every unique
    // thumbnail URL × size. Uploads are already resized to WebP with sharp.
    unoptimized: true,
    remotePatterns: [
      // Cloudflare R2 public bucket / custom CDN domain
      ...(R2_PUBLIC_DOMAIN
        ? [
            {
              protocol: "https" as const,
              hostname: R2_PUBLIC_DOMAIN,
              pathname: "/**",
            },
          ]
        : []),
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
