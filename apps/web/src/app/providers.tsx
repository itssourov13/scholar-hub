"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { AuthProvider, PreviewAuthProvider } from "@/lib/auth";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { LangProvider, type Lang } from "@/lib/lang-context";

export default function Providers({
  children,
  defaultLang,
  previewMode = false,
}: {
  children: React.ReactNode;
  defaultLang?: Lang;
  /** Server-selected, local-build-only visual preview. Authentication is disabled. */
  previewMode?: boolean;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/auth/") ?? false;

  // Auth routes must keep ClerkProvider during static generation because their
  // forms use Clerk hooks. The preview proxy redirects these routes before
  // serving them, while public routes stay entirely off Clerk's client API.
  if (previewMode && !isAuthRoute) {
    return (
      <LangProvider defaultLang={defaultLang}>
        <DialogProvider>
          <PreviewAuthProvider>{children}</PreviewAuthProvider>
        </DialogProvider>
      </LangProvider>
    );
  }

  return (
    <ClerkProvider>
      <LangProvider defaultLang={defaultLang}>
        <DialogProvider>
          <AuthProvider>{children}</AuthProvider>
        </DialogProvider>
      </LangProvider>
    </ClerkProvider>
  );
}
