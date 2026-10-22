import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Manrope, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import MobileTabBar from "@/components/layout/mobile-tab-bar";
import CookieConsentBanner from "@/components/consent/cookie-consent-banner";
import { SITE_URL } from "@/lib/site-config";

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const bengaliFont = Hind_Siliguri({
  variable: "--font-bengali",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
});

const BASE_URL = SITE_URL;

// Unset means the beacon simply isn't rendered — safe for local and preview.
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_SCHOLARHUB_CF_BEACON_TOKEN;

// Keep in sync with DEVICES in scripts/generate-splash-screens.py.
const APPLE_SPLASH_DEVICES: Array<[width: number, height: number, dpr: number]> = [
  [320, 568, 2],
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [414, 896, 2],
  [414, 896, 3],
  [360, 780, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [768, 1024, 2],
  [810, 1080, 2],
  [820, 1180, 2],
  [834, 1112, 2],
  [834, 1194, 2],
  [744, 1133, 2],
  [1024, 1366, 2],
];

const APPLE_SPLASH_SCREENS = APPLE_SPLASH_DEVICES.flatMap(([width, height, dpr]) =>
  ([
    ["portrait", width, height],
    ["landscape", height, width],
  ] as const).map(([orientation, w, h]) => ({
    href: `/splash/apple-splash-${w * dpr}-${h * dpr}.png`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`,
  })),
);

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "ScholarHub — Scholarship Discovery and Study-Abroad Planning",
    template: "%s | ScholarHub",
  },
  description:
    "Explore international scholarship opportunities, understand eligibility and funding, and organize study-abroad applications with ScholarHub. Initial curated coverage focuses on applicants from Bangladesh and may vary by program.",
  keywords: [
    "scholarship Bangladesh",
    "study abroad Bangladesh",
    "international scholarship",
    "PhD scholarship Bangladesh",
    "Masters scholarship",
    "IELTS scholarship",
    "AI scholarship guidance",
    "higher study abroad",
    "ScholarHub",
  ],
  authors: [{ name: "ScholarHub" }],
  creator: "ScholarHub",
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/icon-32.png"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    // The server-rendered (crawlable) content is English; Bangla is applied
    // client-side. Declare English as primary with Bangla as an alternate so
    // the OG locale matches what crawlers actually see.
    locale: "en_US",
    alternateLocale: ["bn_BD"],
    url: BASE_URL,
    siteName: "ScholarHub",
    title: "ScholarHub — Scholarship Discovery and Study-Abroad Planning",
    description:
      "Explore scholarship opportunities and study-abroad guidance. Coverage and eligibility details vary by programme and applicant country.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ScholarHub — Scholarship Discovery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ScholarHub — Scholarship Discovery",
    description:
      "Explore scholarship opportunities and study-abroad guidance. Coverage and eligibility details vary by programme and applicant country.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// Next 16 wants viewport / theme-color declared via the `viewport` export
// rather than inside `metadata`.
export const viewport: Viewport = {
  themeColor: "#0f8f8d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // NOTE: This layout is intentionally NOT async and does NOT read headers()/
  // cookies(). Doing so would opt the entire app into dynamic rendering and
  // disable SSG/ISR everywhere. Locale detection now happens client-side in
  // LangProvider (localStorage preference → navigator.language heuristic).
  // `lang="en"` is the crawlable default (Googlebot crawls the English SSR).
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${bengaliFont.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ScholarHub" />
        {/*
          iOS PWA launch splash screens. Safari doesn't read the manifest's
          icon/background_color for the launch screen like Android does, so
          each device resolution needs its own pre-rendered image (generated
          via scripts/generate-splash-screens.py from public/splashscreen.png).
        */}
        {APPLE_SPLASH_SCREENS.map(({ href, media }) => (
          <link key={href} rel="apple-touch-startup-image" href={href} media={media} />
        ))}
        {/*
          Keep the consent signal available for integrations explicitly
          configured for ScholarHub. No advertising tag is enabled by default.
        */}
        <Script id="consent-mode-default" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            var storedConsent = null;
            try { storedConsent = window.localStorage.getItem('scholarhub_cookie_consent'); } catch (e) {}
            var granted = storedConsent === 'accepted' ? 'granted' : 'denied';
            gtag('consent', 'default', {
              ad_storage: granted,
              analytics_storage: granted,
              ad_user_data: granted,
              ad_personalization: granted,
              wait_for_update: 500
            });
          `}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ScholarHub",
              url: BASE_URL,
              logo: `${BASE_URL}/logo.png`,
              description:
                "Scholarship discovery and study-abroad application planning, with initial curated coverage focused on applicants from Bangladesh.",
            }),
          }}
        />
        {/*
          WebSite + SearchAction — powers the Google sitelinks search box and
          gives search engines / AI assistants a machine-readable way to query
          the scholarship catalog. inLanguage declares bilingual coverage.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "ScholarHub",
              alternateName: "ScholarHub — Scholarship Discovery",
              url: BASE_URL,
              inLanguage: ["en", "bn"],
              publisher: { "@type": "Organization", name: "ScholarHub", url: BASE_URL },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${BASE_URL}/scholarships?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body>
        <Providers previewMode={process.env.SCHOLARHUB_LOCAL_PREVIEW === "1"}>
          {children}
          <MobileTabBar />
          <CookieConsentBanner />
        </Providers>
        {/*
          Only configure this token after creating a separate ScholarHub
          analytics property and reviewing the applicable privacy disclosure.
        */}
        {CF_BEACON_TOKEN && (
          <Script
            id="cf-web-analytics"
            strategy="afterInteractive"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
          />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
