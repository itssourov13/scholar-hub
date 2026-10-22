"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/lang-context";
import { homeHref, isHomePath } from "@/lib/i18n";
import styles from "./lang-toggle.module.css";

export default function LangToggle() {
  const { lang, setLang } = useLang();
  const pathname = usePathname() ?? "/";
  const nextLang = lang === "en" ? "bn" : "en";
  const label = lang === "en" ? "বাংলা" : "English";
  const aria = lang === "en" ? "বাংলায় পড়ুন" : "Switch to English";
  const title = lang === "en" ? "Switch to Bangla" : "Switch to English";

  // Homepage has a real localized URL pair (/ ↔ /bn). Flip the preference
  // AND navigate so the address bar matches the rest of the app. Other pages
  // only have chrome translations, so they stay on the same path.
  if (isHomePath(pathname)) {
    return (
      <Link
        href={homeHref(nextLang)}
        className={styles.toggle}
        hrefLang={nextLang}
        onClick={() => setLang(nextLang)}
        aria-label={aria}
        title={title}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setLang(nextLang)}
      aria-label={aria}
      title={title}
    >
      {label}
    </button>
  );
}
