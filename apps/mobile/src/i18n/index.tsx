import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { getLocales } from "expo-localization";
import { translations, type Lang, type TranslationKey } from "./translations";

export type { Lang, TranslationKey };

export const LANG_STORAGE = "bp_lang";

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  ready: boolean;
};

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  ready: false,
});

/** Device default: Bangla only when the top locale is Bengali, else English. */
function deviceDefault(): Lang {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    return code === "bn" ? "bn" : "en";
  } catch {
    return "en";
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = (await SecureStore.getItemAsync(LANG_STORAGE)) as Lang | null;
        if (active) setLangState(stored === "bn" || stored === "en" ? stored : deviceDefault());
      } catch {
        if (active) setLangState(deviceDefault());
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    SecureStore.setItemAsync(LANG_STORAGE, l).catch(() => {});
  };

  return <LangContext.Provider value={{ lang, setLang, ready }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Returns a translate function scoped to the current language. */
export function useT() {
  const { lang } = useLang();
  return (key: TranslationKey): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] ?? entry.en ?? key;
  };
}
