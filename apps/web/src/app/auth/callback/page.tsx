"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useT } from "@/lib/lang-context";
import styles from "../auth.module.css";

const DEFAULT_DESTINATION = "/";

/** `next` arrives from the query string, so only same-origin paths are honoured. */
function safeDestination(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return DEFAULT_DESTINATION;
  return next;
}

function Callback() {
  const t = useT();
  const destination = safeDestination(useSearchParams().get("next"));

  return (
    <div className={styles.page}>
      {/* Clerk only sends the browser here when the OAuth attempt still needs work in
          the client — most importantly transferring a Google sign-in that has no
          matching user into a sign-up. Without this the visitor ends up signed out. */}
      <AuthenticateWithRedirectCallback
        signInUrl="/auth/login"
        signUpUrl="/auth/signup"
        signInForceRedirectUrl={destination}
        signUpForceRedirectUrl={destination}
      />

      <div className={styles.card}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="ScholarHub Logo" width={28} height={28} className={styles.logoImage} />
          <span className={styles.logoText}>ScholarHub</span>
        </div>
        <h1 className={styles.heading}>{t("callback.heading")}</h1>
        <p className={styles.sub}>{t("callback.sub")}</p>
        <div className={styles.spinner} role="status" aria-label={t("callback.heading")} />

        {/* Bot protection is on for sign-ups, so the transfer above needs a Turnstile mount point. */}
        <div id="clerk-captcha" />
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
