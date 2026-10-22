"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "./cv-builder.module.css";

export default function CVBuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CV Builder error:", error);
  }, [error]);

  return (
    <div className={styles.page}>
      <main
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          textAlign: "center",
          padding: "24px",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, color: "var(--text-muted, #666)" }}>
          We hit a snag loading this page. Your data is safe — try again, or
          head back to the CV Builder.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: "#0f8f8d",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/cv-builder"
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "1px solid #d4cfc7",
              color: "inherit",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to CV Builder
          </Link>
        </div>
      </main>
    </div>
  );
}
