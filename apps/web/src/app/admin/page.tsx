"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import styles from "./admin.module.css";

type Stats = { total: number; published: number; drafts: number; guides: number };

export default function AdminDashboard() {
  const { userId } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, drafts: 0, guides: 0 });

  useEffect(() => {
    fetch("/api/admin/scholarships")
      .then((r) => r.json())
      .then(({ scholarships = [] }) => {
        setStats((prev) => ({
          ...prev,
          total: scholarships.length,
          published: scholarships.filter((s: { status: string }) => s.status === "published").length,
          drafts: scholarships.filter((s: { status: string }) => s.status === "draft").length,
        }));
      });
    fetch("/api/admin/guides")
      .then((r) => r.json())
      .then(({ guides = [] }) => {
        setStats((prev) => ({ ...prev, guides: guides.length }));
      });
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1>Dashboard</h1>
          <p className={styles.sub}>Welcome, {userId}</p>
        </div>
        <Link href="/admin/scholarships/new" className={styles.primaryBtn}>
          + Add scholarship
        </Link>
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Total scholarships</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.published}</span>
          <span className={styles.statLabel}>Published</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.guides}</span>
          <span className={styles.statLabel}>Guides</span>
        </div>
      </div>

      <div className={styles.quickLinks}>
        <Link href="/admin/guides" className={styles.linkCard}>
          <span className={styles.linkIcon}>📝</span>
          <span>Manage Guides</span>
        </Link>
        <Link href="/admin/scholarships" className={styles.linkCard}>
          <span className={styles.linkIcon}>🎓</span>
          <span>Manage Scholarships</span>
        </Link>
        <Link href="/admin/scholarships/bulk" className={styles.linkCard} style={{ borderColor: "rgba(124, 58, 237, 0.35)" }}>
          <span className={styles.linkIcon}>🧪</span>
          <span>Bulk Import (Experimental)</span>
        </Link>
        <Link href="/scholarships" className={styles.linkCard}>
          <span className={styles.linkIcon}>🌐</span>
          <span>View Public Listing</span>
        </Link>
        <Link href="/chat" className={styles.linkCard}>
          <span className={styles.linkIcon}>💬</span>
          <span>AI Mentor Chat</span>
        </Link>
        <Link href="/admin/push" className={styles.linkCard} style={{ borderColor: "rgba(15, 143, 141, 0.35)" }}>
          <span className={styles.linkIcon}>📣</span>
          <span>Send Announcement</span>
        </Link>
      </div>
    </div>
  );
}
