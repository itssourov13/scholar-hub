"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  getStoredConsent,
  setStoredConsent,
  type ConsentChoice,
} from "@/lib/consent";
import styles from "./cookie-consent-banner.module.css";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Keeps Google Consent Mode state consistent if analytics/ad tags are configured later. */
function updateGoogleConsent(choice: ConsentChoice) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const state = choice === "accepted" ? "granted" : "denied";
  window.gtag("consent", "update", {
    ad_storage: state,
    analytics_storage: state,
    ad_user_data: state,
    ad_personalization: state,
  });
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active && getStoredConsent() === null) setVisible(true);
    });

    const handleReopen = () => setVisible(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleReopen);
    return () => {
      active = false;
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleReopen);
    };
  }, []);

  const handleChoice = (choice: ConsentChoice) => {
    setStoredConsent(choice);
    updateGoogleConsent(choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.wrapper} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className={styles.card}>
        <p className={styles.text}>
          ScholarHub saves your cookie preference on this device. Optional analytics
          or advertising integrations will only be enabled after they are configured
          for this deployment and described in the Cookie Policy. See our{" "}
          <Link href="/legal/cookies">Cookie Policy</Link> for details.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.rejectBtn}
            onClick={() => handleChoice("rejected")}
          >
            Reject
          </button>
          <button
            type="button"
            className={styles.acceptBtn}
            onClick={() => handleChoice("accepted")}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
