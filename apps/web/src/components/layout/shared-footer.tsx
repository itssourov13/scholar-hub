"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/lang-context";
import { openCookieSettings } from "@/lib/consent";
import {
  FACEBOOK_URL,
  PLAY_STORE_URL,
  SUPPORT_EMAIL,
} from "@/lib/site-config";
import styles from "./shared-footer.module.css";

export default function SharedFooter() {
  const { userId } = useAuth();
  const t = useT();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <div className={styles.footerLogo}>
            <Image
              src="/logo.png"
              alt="ScholarHub"
              width={24}
              height={24}
              className={styles.footerBrandLogo}
            />
            <strong>ScholarHub</strong>
          </div>
          <p className={styles.footerTagline}>
            {t("footer.tagline").split("\n").map((line, index) => (
              <span key={`${line}-${index}`}>
                {line}
                {index === 0 && <br />}
              </span>
            ))}
          </p>
          <p className={styles.footerCopyright}>
            © {new Date().getFullYear()} ScholarHub. {t("footer.copyright")}
          </p>
          <button
            type="button"
            onClick={openCookieSettings}
            className={styles.footerCookieSettings}
          >
            {t("footer.cookieSettings")}
          </button>
          {PLAY_STORE_URL && (
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerPlayBadge}
              aria-label="Get ScholarHub on Google Play"
            >
              <Image
                src="/google-play-badge-logo-svgrepo-com.svg"
                alt="Get it on Google Play"
                width={135}
                height={40}
                className={styles.footerPlayBadgeImg}
              />
            </a>
          )}
        </div>

        <div className={styles.footerColumns}>
          <div className={styles.footerCol}>
            <h4>{t("footer.platform")}</h4>
            <Link href="/scholarships">{t("footer.browseScholarships")}</Link>
            <Link href="/chat">{t("nav.aiMentor")}</Link>
            <Link href="/guide">{t("footer.studyGuides")}</Link>
            <Link href={userId ? "/dashboard" : "/auth/login"}>{t("nav.dashboard")}</Link>
          </div>
          <div className={styles.footerCol}>
            <h4>{t("footer.account")}</h4>
            <Link href="/auth/login">{t("nav.signIn")}</Link>
            <Link href="/auth/signup">{t("footer.createAccount")}</Link>
          </div>
          <div className={styles.footerCol}>
            <h4>{t("footer.legal")}</h4>
            <Link href="/legal/about">{t("footer.aboutUs")}</Link>
            <Link href="/legal/contact">{t("footer.contactUs")}</Link>
            <Link href="/legal/privacy">{t("footer.privacyPolicy")}</Link>
            <Link href="/legal/cookies">{t("footer.cookiePolicy")}</Link>
            <Link href="/legal/terms">{t("footer.termsOfService")}</Link>
            <Link href="/legal/partner">{t("footer.partnerWithUs")}</Link>
          </div>
          <div className={styles.footerCol}>
            <h4>{t("footer.connectSupport")}</h4>
            {SUPPORT_EMAIL && (
              <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.footerEmail}>
                {SUPPORT_EMAIL}
              </a>
            )}
            {FACEBOOK_URL && (
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerEmail}
                aria-label="ScholarHub on Facebook"
              >
                Facebook
              </a>
            )}
            {!SUPPORT_EMAIL && !FACEBOOK_URL && (
              <p className={styles.footerSupportNote}>
                Support contact details will be published before public launch.
              </p>
            )}
            <p className={styles.footerSupportNote}>{t("footer.replyTime")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
