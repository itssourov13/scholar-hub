"use client";

import { useEffect } from "react";
import { ForcedLang, useLang } from "@/lib/lang-context";

/**
 * Layout for the Bangla (/bn) locale subtree. ForcedLang overrides the
 * *displayed* language for SSR (crawlers index Bangla) without replacing the
 * root LangProvider — so the language toggle still writes the shared
 * preference and a second switch back to English does not need a refresh.
 *
 * Visiting /bn also persists Bangla as the app preference, so leaving for
 * /scholarships (etc.) stays in Bangla instead of snapping back to English.
 *
 * The root <html lang> is fixed to "en" by the root layout; we correct it to
 * "bn" on the client for accessibility/Bing (a weak, best-effort signal —
 * hreflang + fully-translated visible content are the primary locale signals).
 */
export default function BanglaLayout({ children }: { children: React.ReactNode }) {
  const { setLang } = useLang();

  useEffect(() => {
    setLang("bn");
    const prev = document.documentElement.lang;
    document.documentElement.lang = "bn";
    return () => {
      document.documentElement.lang = prev;
    };
  }, [setLang]);

  return <ForcedLang lang="bn">{children}</ForcedLang>;
}
