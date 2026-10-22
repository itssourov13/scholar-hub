"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import styles from "../admin.module.css";
import { MAX_COVER_IMAGE_BYTES, formatFileSize } from "@/lib/client-image";

type SendResult = { sent: number; failed: number; invalid: number; targeted: number };
type TokenStats = {
  configured: boolean;
  total: number;
  active: number;
  disabled: number;
  seen7d: number;
};

export default function PushBroadcastPage() {
  const [titleEn, setTitleEn] = useState("AI Mentor & CV Analysis are faster now ⚡");
  const [bodyEn, setBodyEn] = useState(
    "If chat or CV analysis felt slow or didn't work before, please try again — we've fixed it!",
  );
  const [titleBn, setTitleBn] = useState("AI মেন্টর ও CV বিশ্লেষণ এখন আরও দ্রুত ⚡");
  const [bodyBn, setBodyBn] = useState(
    "আগে চ্যাট বা CV বিশ্লেষণ ধীর মনে হলে বা কাজ না করলে, আবার চেষ্টা করুন — আমরা এটি ঠিক করেছি!",
  );
  const [url, setUrl] = useState("/chat");
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [stats, setStats] = useState<TokenStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/push/broadcast")
      .then((r) => r.json())
      .then((json) => {
        if (typeof json.active === "number") {
          setStats({
            configured: Boolean(json.configured),
            total: json.total,
            active: json.active,
            disabled: json.disabled,
            seen7d: json.seen7d,
          });
        }
      })
      .catch(() => {});
  }, [result]);

  const clearThumbnail = () => {
    setImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setImageUrl(null);
  };

  const onThumbnailFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_COVER_IMAGE_BYTES) {
      setError(`Image is too big (${formatFileSize(file.size)}). Please use under ${formatFileSize(MAX_COVER_IMAGE_BYTES)}.`);
      return;
    }

    setImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setImageUrl(null);
    setError("");
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/push/thumbnail", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        clearThumbnail();
        setError(json.error ?? "Thumbnail upload failed.");
        return;
      }
      setImageUrl(json.imageUrl as string);
    } catch (err) {
      clearThumbnail();
      setError(String(err));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/push/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleEn, bodyEn, titleBn, bodyBn, url, includeDisabled, imageUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to send push notification.");
        return;
      }
      setResult({
        sent: json.sent,
        failed: json.failed,
        invalid: json.invalid,
        targeted: json.targeted,
      });
      setConfirming(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(
    titleEn.trim() && bodyEn.trim() && titleBn.trim() && bodyBn.trim() && !uploadingImage,
  );
  const audience = includeDisabled ? (stats?.total ?? null) : (stats?.active ?? null);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin → Push</p>
          <h1>Send Announcement</h1>
          <p className={styles.sub}>
            Sends a real push notification to every device that has registered for
            notifications — not every Play Store install. Installs who never signed in,
            denied the permission prompt, or uninstalled are not in this list.
          </p>
        </div>
        <Link href="/admin" className={styles.ghostBtn}>
          ← Back
        </Link>
      </header>

      {stats && !stats.configured && (
        <p className={styles.error}>
          Push is not configured on this deployment (missing FCM_SERVICE_ACCOUNT). Sends will fail.
        </p>
      )}

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.active}</span>
            <span className={styles.statLabel}>Active devices (will receive this)</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.seen7d}</span>
            <span className={styles.statLabel}>Opened the app in the last 7 days</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.disabled}</span>
            <span className={styles.statLabel}>Disabled (uninstalled / stale token)</span>
          </div>
        </div>
      )}

      <div className={styles.formCard}>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label>Title (English)</label>
            <input
              type="text"
              maxLength={80}
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label>Title (বাংলা)</label>
            <input
              type="text"
              maxLength={80}
              value={titleBn}
              onChange={(e) => setTitleBn(e.target.value)}
            />
          </div>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Body (English)</label>
            <textarea rows={3} maxLength={200} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} />
          </div>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Body (বাংলা)</label>
            <textarea rows={3} maxLength={200} value={bodyBn} onChange={(e) => setBodyBn(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Tap opens (in-app path)</label>
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/chat" />
          </div>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>
              Thumbnail{" "}
              <span style={{ fontWeight: 500, color: "var(--ink-500, #6b7c8d)" }}>(optional — expandable big picture)</span>
            </label>
            <div className={styles.uploadArea}>
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Announcement thumbnail preview" className={styles.thumbPreview} />
              ) : (
                <div className={styles.uploadPlaceholder}>
                  <span>🖼</span>
                  <span>No image — text-only notification</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <label className={styles.uploadLabel}>
                  {uploadingImage ? "Uploading…" : imageUrl ? "Change image" : "Choose image"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onThumbnailFile}
                    disabled={uploadingImage || sending}
                    style={{ display: "none" }}
                  />
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={clearThumbnail}
                    disabled={uploadingImage || sending}
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className={styles.uploadHint}>
                Same as scholarship &amp; guide pushes. PNG, JPG, WebP — recommended 1200×630px,
                max {formatFileSize(MAX_COVER_IMAGE_BYTES)}.
              </p>
            </div>
          </div>
        </div>

        {stats && stats.disabled > 0 && (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 18, fontSize: 13, color: "var(--ink-700, #2c3e50)" }}>
            <input
              type="checkbox"
              checked={includeDisabled}
              onChange={(e) => setIncludeDisabled(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              Also retry {stats.disabled} previously-invalid token{stats.disabled === 1 ? "" : "s"}.
              Use this once if an earlier send may have marked live devices as dead. Truly uninstalled
              apps will be pruned again.
            </span>
          </label>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {result && (
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--teal-700, #0a6b6a)",
              background: "rgba(15, 143, 141, 0.08)",
              border: "1px solid rgba(15, 143, 141, 0.25)",
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            ✅ Sent to {result.sent} of {result.targeted} device{result.targeted === 1 ? "" : "s"}
            {result.failed > 0 && ` — ${result.failed} temporarily failed (retry later)`}
            {result.invalid > 0 && ` — ${result.invalid} stale token(s) cleaned up`}
          </p>
        )}

        <div className={styles.formActions}>
          {!confirming ? (
            <button
              type="button"
              className={styles.enrichBtn}
              disabled={!canSend || sending || uploadingImage}
              onClick={() => setConfirming(true)}
            >
              📣 Send to {audience != null ? `${audience} device${audience === 1 ? "" : "s"}` : "all users"}
            </button>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#b14a2a", fontWeight: 600, margin: "0 auto 0 0" }}>
                This goes out to {audience != null ? `${audience} registered device${audience === 1 ? "" : "s"}` : "every registered device"} right now. Send it?
              </p>
              <button type="button" className={styles.ghostBtn} onClick={() => setConfirming(false)} disabled={sending}>
                Cancel
              </button>
              <button type="button" className={styles.enrichBtn} onClick={handleSend} disabled={sending || uploadingImage || (Boolean(imagePreview) && !imageUrl)}>
                {sending ? (
                  <>
                    <span className={styles.spinner} />
                    Sending…
                  </>
                ) : (
                  "Yes, send now"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
