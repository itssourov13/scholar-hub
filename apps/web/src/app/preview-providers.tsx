"use client";

import { PreviewAuthProvider } from "@/lib/preview-auth";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { LangProvider, type Lang } from "@/lib/lang-context";

export default function PreviewProviders({
  children,
  defaultLang,
}: {
  children: React.ReactNode;
  defaultLang?: Lang;
}) {
  return (
    <LangProvider defaultLang={defaultLang}>
      <DialogProvider>
        <PreviewAuthProvider>{children}</PreviewAuthProvider>
      </DialogProvider>
    </LangProvider>
  );
}
