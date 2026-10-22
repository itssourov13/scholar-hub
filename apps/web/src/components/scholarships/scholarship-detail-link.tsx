"use client";

import Link from "next/link";
import type { LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useDialog } from "@/components/ui/dialog-provider";

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    children?: ReactNode;
  };

/**
 * Drop-in replacement for next/link used anywhere a click leads to a
 * scholarship detail page. Signed-out users see a "Sign in required" popup
 * instead of navigating; the underlying <a href> stays intact so search
 * engine crawlers can still discover and index the detail page.
 */
export default function ScholarshipDetailLink({
  href,
  onClick,
  children,
  ...rest
}: Props) {
  const { userId } = useAuth();
  const router = useRouter();
  const dialog = useDialog();

  const handleClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (userId) return;

    e.preventDefault();
    const target = typeof href === "string" ? href : (href.pathname ?? "/scholarships");
    const wantsToSignIn = await dialog.confirm({
      title: "Sign in required",
      description: "Please sign in to view scholarship details.",
      confirmText: "Sign In",
    });
    if (wantsToSignIn) {
      router.push(`/auth/login?redirect=${encodeURIComponent(target)}`);
    }
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
