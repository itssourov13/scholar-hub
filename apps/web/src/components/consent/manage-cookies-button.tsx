"use client";

import { openCookieSettings } from "@/lib/consent";
import styles from "./manage-cookies-button.module.css";

export default function ManageCookiesButton({
  label = "Manage cookie settings",
}: {
  label?: string;
}) {
  return (
    <button type="button" className={styles.button} onClick={openCookieSettings}>
      {label}
    </button>
  );
}
