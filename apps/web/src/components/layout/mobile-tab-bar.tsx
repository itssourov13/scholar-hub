"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useLang, useT } from "@/lib/lang-context";
import { homeHref, isHomePath } from "@/lib/i18n";
import styles from "./mobile-tab-bar.module.css";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** A path the tab also "owns" — e.g. /scholarships/[id] still highlights Scholarships. */
  matchPrefix?: string;
  home?: boolean;
};

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 12 L12 3 L21 12" />
    <path d="M5 10 V20 H10 V14 H14 V20 H19 V10" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 4 H10 A4 4 0 0 1 14 8 V20 A3 3 0 0 0 11 17 H4 Z" />
    <path d="M20 4 H14 A4 4 0 0 0 10 8" />
    <path d="M20 4 V17 H13" />
  </svg>
);

const GuideIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5 L13 13 L8.5 15.5 L11 11 Z" />
  </svg>
);

const MentorIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 12 A8 8 0 1 1 12.5 4 H13 A8 8 0 0 1 21 12 Z" />
    <path d="M8 14 H16" />
    <path d="M8 10 H13" />
    <path d="M8 18 L5 21 V18" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21 C4 16.5 7.5 14 12 14 C16.5 14 20 16.5 20 21" />
  </svg>
);

/**
 * Bottom tab bar visible only on mobile (≤720px). Pinned to viewport bottom,
 * accounts for iOS safe area, and highlights the current section.
 *
 * The bar is rendered globally from the root layout. Pages that have their
 * own full-height layout (e.g. /chat) handle bottom padding themselves so
 * their input doesn't sit underneath the tab bar.
 */
export default function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const { userId } = useAuth();
  const t = useT();
  const { lang } = useLang();

  // Hide the tab bar on auth flow pages — they're focused, modal-like
  // experiences where extra navigation is a distraction.
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/legal")
  ) {
    return null;
  }

  const tabs: Tab[] = [
    { href: homeHref(lang), label: t("tab.home"), icon: <HomeIcon />, home: true },
    {
      href: "/scholarships",
      label: t("nav.scholarships"),
      icon: <BookIcon />,
      matchPrefix: "/scholarships",
    },
    { href: "/guide", label: t("tab.guide"), icon: <GuideIcon />, matchPrefix: "/guide" },
    { href: "/chat", label: t("tab.mentor"), icon: <MentorIcon />, matchPrefix: "/chat" },
    {
      // Logged-in users go to the dashboard. Anonymous users go to signup
      // since the dashboard is gated.
      href: userId ? "/dashboard" : "/auth/signup",
      label: userId ? t("nav.dashboard") : t("tab.signUp"),
      icon: <UserIcon />,
      matchPrefix: userId ? "/dashboard" : undefined,
    },
  ];

  const isActive = (tab: Tab) => {
    if (tab.home) return isHomePath(pathname);
    if (tab.matchPrefix) {
      return pathname === tab.matchPrefix || pathname.startsWith(`${tab.matchPrefix}/`);
    }
    return pathname === tab.href;
  };

  return (
    <nav className={styles.tabBar} aria-label="Primary">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`${styles.tab} ${isActive(tab) ? styles.tabActive : ""}`}
          aria-current={isActive(tab) ? "page" : undefined}
        >
          {tab.icon}
          <span className={styles.tabLabel}>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
