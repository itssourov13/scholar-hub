"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { Lang } from "@/lib/lang-context";

// Keep Clerk in a separate chunk: the public local-preview pages must not load
// Clerk's client bundle or try to resolve the placeholder .local frontend API.
const ClerkProviders = dynamic(() => import("./clerk-providers"));
const PreviewProviders = dynamic(() => import("./preview-providers"));

export default function Providers({
  children,
  defaultLang,
  previewMode = false,
}: {
  children: React.ReactNode;
  defaultLang?: Lang;
  /** Enabled only for a local, unauthenticated visual preview build. */
  previewMode?: boolean;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/auth/") ?? false;

  // Login pages need Clerk during build/runtime; the local-preview proxy redirects
  // them to the public site. Keep regular provider behavior when preview is off.
  if (previewMode && !isAuthRoute) {
    return <PreviewProviders defaultLang={defaultLang}>{children}</PreviewProviders>;
  }

  return <ClerkProviders defaultLang={defaultLang}>{children}</ClerkProviders>;
}
