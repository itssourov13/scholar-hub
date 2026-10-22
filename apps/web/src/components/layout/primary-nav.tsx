"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useT, useLang } from "@/lib/lang-context";
import { homeHref, isHomePath } from "@/lib/i18n";
import styles from "./primary-nav.module.css";

type PrimaryNavProps = {
  className?: string;
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
};

export default function PrimaryNav({ className, orientation = "horizontal", onNavigate }: PrimaryNavProps) {
  const pathname = usePathname();
  const { role } = useAuth();
  const t = useT();
  const { lang } = useLang();

  const NAV_LINKS: Array<{
    label: string;
    href: string;
    desktopOnly?: boolean;
    home?: boolean;
  }> = [
    { label: t("nav.home"), href: homeHref(lang), home: true },
    { label: t("nav.scholarships"), href: "/scholarships" },
    { label: t("nav.guideline"), href: "/guide", desktopOnly: true },
    { label: t("nav.dashboard"), href: "/dashboard" },
    { label: t("nav.aiMentor"), href: "/chat" },
    { label: t("nav.cvBuilder"), href: "/cv-builder" },
    ...(role === "admin" ? [{ label: t("nav.admin"), href: "/admin" }] : []),
  ].filter((link) => !(link.desktopOnly && orientation === "vertical"));

  return (
    <nav
      className={`${styles.nav} ${orientation === "vertical" ? styles.vertical : ""} ${className ?? ""}`.trim()}
    >
      {NAV_LINKS.map((link) => {
        const isActive = link.home
          ? isHomePath(pathname ?? "/")
          : pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={isActive ? styles.active : undefined}
            onClick={onNavigate}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
