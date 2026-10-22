"use client";

import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/lang-context";
import AppNavbar from "@/components/layout/app-navbar";

/**
 * Thin client wrapper around AppNavbar that automatically wires up
 * auth-aware Sign in / Sign out actions.
 *
 * Use this in server-rendered pages (like /guide) instead of
 * <AppNavbar /> so the nav stays consistent with the rest of the app.
 */
export default function NavbarWithAuth() {
  const { userId, loading, signOut } = useAuth();
  const t = useT();

  const actions = loading
    ? []
    : [
        userId
          ? { label: t("nav.signOut"), onClick: signOut }
          : { label: t("nav.signIn"), href: "/auth/login", variant: "ghost" as const },
        !userId ? { label: t("nav.getStarted"), href: "/auth/signup" } : null,
      ].filter(Boolean) as Parameters<typeof AppNavbar>[0]["actions"];

  return <AppNavbar actions={actions} />;
}
