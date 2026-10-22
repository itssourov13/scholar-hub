"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { routeLocale } from "./i18n";
import { translations, type Lang, type TranslationKey } from "./translations";

export type { Lang };

type LangContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
};

const LangContext = createContext<LangContextType>({
  lang: "bn",
  setLang: () => {},
});

/**
 * Route-level display override (used by the /bn layout). This MUST NOT be a
 * nested LangProvider: a second provider would intercept setLang, so the root
 * preference would stay stale after navigating back to an English URL.
 */
const ForcedLangContext = createContext<Lang | null>(null);

export function ForcedLang({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <ForcedLangContext.Provider value={lang}>{children}</ForcedLangContext.Provider>;
}

export function LangProvider({
  children,
  defaultLang = "en",
}: {
  children: ReactNode;
  defaultLang?: Lang;
}) {
  // Start from English so the server-rendered (crawlable) markup matches the
  // <html lang="en"> attribute — this keeps hydration deterministic and lets
  // every page render statically (no headers()/cookies() on the server).
  const [lang, setLangState] = useState<Lang>(defaultLang);

  useEffect(() => {
    try {
      // 1) Explicit user preference always wins.
      const stored = localStorage.getItem("bp_lang") as Lang | null;
      if (stored === "bn" || stored === "en") {
        setLangState(stored);
        return;
      }
      // 2) No stored preference → infer from the browser locale. This replaces
      //    the old server-side geo detection while keeping the app static:
      //    Bangla-locale visitors (e.g. bn-BD) still get Bangla automatically.
      if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("bn")) {
        setLangState("bn");
      }
    } catch {
      // ignore
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      // Persist to localStorage for client-side reads
      localStorage.setItem("bp_lang", l);
      // Persist to cookie so future server renders respect the explicit choice
      document.cookie = `bp_lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  const forced = useContext(ForcedLangContext);
  const pathname = usePathname();
  // `/bn` is always Bangla (SEO + shared links). Every other page — including
  // `/` — follows the stored preference so the switcher cannot desync the
  // homepage from scholarships/chat/etc.
  const fromRoute = routeLocale(pathname ?? "/");
  return {
    lang: forced ?? fromRoute ?? ctx.lang,
    setLang: ctx.setLang,
  };
}

/** Returns a translate function scoped to the current language. */
export function useT() {
  const { lang } = useLang();
  return (key: TranslationKey): string => {
    const entry = translations[key];
    if (!entry) return key as string;
    return (entry as Record<Lang, string>)[lang] ?? (entry as Record<Lang, string>).en ?? (key as string);
  };
}
