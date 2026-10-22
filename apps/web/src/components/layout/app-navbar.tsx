"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import PrimaryNav from "@/components/layout/primary-nav";
import LangToggle from "@/components/layout/lang-toggle";
import { useAuth } from "@/lib/auth-context";
import { useLang, useT } from "@/lib/lang-context";
import { homeHref } from "@/lib/i18n";
import styles from "./app-navbar.module.css";

export type NavAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
};

type AppNavbarProps = {
  actions?: NavAction[];
};

export default function AppNavbar({ actions = [] }: AppNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useT();
  const { lang } = useLang();

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={styles.nav}>
      <Link href={homeHref(lang)} className={styles.brand} style={{ textDecoration: 'none', color: 'inherit' }}>
        <Image src="/logo.png" alt="ScholarHub Logo" width={28} height={28} className={styles.brandLogo} />
        <span>ScholarHub</span>
      </Link>
      <PrimaryNav className={styles.navLinks} />
      <button
        type="button"
        className={styles.mobileToggle}
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-controls="mobile-nav-panel"
        aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
      >
        {menuOpen ? t("nav.close") : t("nav.menu")}
      </button>
      <div className={styles.actions}>
        <LangToggle />
        {actions.map((action) => {
          const className = action.variant === "ghost" ? styles.ghostButton : styles.actionButton;
          return action.href ? (
            <Link key={action.label} className={className} href={action.href}>
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              className={className}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          );
        })}
      </div>
      {menuOpen ? (
        <>
          <button
            type="button"
            className={styles.mobileBackdrop}
            onClick={closeMenu}
            aria-label={t("nav.closeMenu")}
          />
          <div className={styles.mobilePanel} id="mobile-nav-panel" role="dialog" aria-modal="true">
            <div className={styles.mobilePanelHeader}>
              <span>{t("nav.navigate")}</span>
              <button type="button" className={styles.mobileClose} onClick={closeMenu}>
                {t("nav.close")}
              </button>
            </div>
            <PrimaryNav orientation="vertical" onNavigate={closeMenu} />
            <div className={styles.mobileActions}>
              <LangToggle />
              {actions.map((action) => {
                const className = action.variant === "ghost" ? styles.ghostButton : styles.actionButton;
                return action.href ? (
                  <Link key={action.label} className={className} href={action.href} onClick={closeMenu}>
                    {action.label}
                  </Link>
                ) : (
                  <button
                    key={action.label}
                    type="button"
                    className={className}
                    onClick={() => {
                      closeMenu();
                      action.onClick?.();
                    }}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
