import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  // Don't index the 404 itself, but let crawlers follow the links out of it.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 16,
        padding: "48px 20px",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0b6d6b" }}>
        404
      </p>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 36px)", margin: 0 }}>
        We couldn&apos;t find that page
      </h1>
      <p style={{ maxWidth: "52ch", color: "#4a453f", lineHeight: 1.6, margin: 0 }}>
        The page you were looking for may have moved or the scholarship may have
        closed. Here are some good places to continue from:
      </p>
      <nav
        aria-label="Helpful links"
        style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 8 }}
      >
        <Link href="/" style={linkStyle}>Home</Link>
        <Link href="/scholarships" style={linkStyle}>Browse scholarships</Link>
        <Link href="/guide" style={linkStyle}>Study abroad guides</Link>
        <Link href="/chat" style={linkStyle}>Ask the AI mentor</Link>
      </nav>
    </main>
  );
}

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 18px",
  borderRadius: 12,
  border: "1px solid rgba(15,143,141,0.3)",
  color: "#0b6d6b",
  fontWeight: 600,
  fontSize: 14,
  textDecoration: "none",
};
