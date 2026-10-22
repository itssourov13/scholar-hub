"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname ?? "/")}`);
    }
  }, [loading, userId, pathname, router]);

  if (loading || !userId) return null;

  return <>{children}</>;
}
