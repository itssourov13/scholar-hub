"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/lib/auth";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { LangProvider, type Lang } from "@/lib/lang-context";

export default function Providers({
  children,
  defaultLang,
}: {
  children: React.ReactNode;
  defaultLang?: Lang;
}) {
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
