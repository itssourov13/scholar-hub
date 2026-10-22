/**
 * Public ScholarHub deployment configuration.
 *
 * Set these values for the target deployment. Empty optional links are omitted
 * from the UI so a new deployment never points users at the legacy product.
 */
function cleanUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export const SITE_URL =
  cleanUrl(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000";

export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "").trim();
export const FACEBOOK_URL = cleanUrl(process.env.NEXT_PUBLIC_FACEBOOK_URL);
export const TELEGRAM_URL = cleanUrl(process.env.NEXT_PUBLIC_TELEGRAM_URL);
export const PLAY_STORE_URL = cleanUrl(process.env.NEXT_PUBLIC_PLAY_STORE_URL);
