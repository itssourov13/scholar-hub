"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { userId, role, loading, roleLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!userId) router.replace(`/auth/login?redirect=${encodeURIComponent(pathname ?? "/admin")}`);
    else if (role && role !== "admin") router.replace("/");
  }, [loading, roleLoading, userId, role, pathname, router]);

  if (loading || roleLoading || !userId || role !== "admin") return null;

  return <>{children}</>;
}
