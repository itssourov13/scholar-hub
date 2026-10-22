"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import AppNavbar, { NavAction } from "@/components/layout/app-navbar";
import SharedFooter from "@/components/layout/shared-footer";
import styles from "./legal.module.css";

export type LegalSection = {
  id: string;
  title: string;
  body: React.ReactNode;
};

type LegalLayoutProps = {
  kicker: string;
  title: string;
  lastUpdated?: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  contact?: React.ReactNode;
};

/**
 * Shared layout for static legal pages (privacy / terms).
 * Renders a sticky table of contents on desktop and an inline list on mobile.
 */
export default function LegalLayout({
  kicker,
  title,
  lastUpdated,
  intro,
  sections,
  contact,
}: LegalLayoutProps) {
  const { userId, signOut } = useAuth();

  const actions: NavAction[] = userId
    ? [{ label: "Sign out", onClick: signOut }]
    : [
        { label: "Sign in", href: "/auth/login", variant: "ghost" },
        { label: "Get started", href: "/auth/signup" },
      ];

  return (
    <div className={styles.page}>
      <AppNavbar actions={actions} />

      <main className={styles.main}>
        <header className={styles.hero}>
          <p className={styles.kicker}>{kicker}</p>
          <h1>{title}</h1>
          {lastUpdated && (
            <p className={styles.lastUpdated}>Last updated: {lastUpdated}</p>
          )}
          <div className={styles.disclaimer}>{intro}</div>
        </header>

        <aside className={styles.toc} aria-label="Table of contents">
          <span className={styles.tocTitle}>On this page</span>
          {sections.map((s) => (
            <Link key={s.id} href={`#${s.id}`} className={styles.tocLink}>
              {s.title}
            </Link>
          ))}
        </aside>

        <article className={styles.article}>
          {sections.map((s) => (
            <section key={s.id} id={s.id} className={styles.section}>
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}

          {contact && <div className={styles.contactCard}>{contact}</div>}
        </article>
      </main>
      <SharedFooter />
    </div>
  );
}
