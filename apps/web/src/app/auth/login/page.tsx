"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs/legacy";
import { useT } from "@/lib/lang-context";
import styles from "../auth.module.css";

type Step = "form" | "client-trust";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `redirect` is set when a guard bounced the visitor off a protected page.
  const redirect = searchParams.get("redirect") ?? "/";
  const t = useT();
  const { signIn, isLoaded, setActive } = useSignIn() as any;

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trustCode, setTrustCode] = useState("");
  const [trustStrategy, setTrustStrategy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handles Clerk's "Client Trust" second-factor challenge, which is triggered
  // for password sign-ins from a client/device Clerk hasn't seen verify before.
  // Without this, those sign-ins get stuck at a non-"complete" status forever.
  const startClientTrustVerification = async (result: any) => {
    const factors: { strategy?: string }[] = result.supportedSecondFactors ?? [];
    const strategy =
      factors.find((f) => f.strategy === "email_code")?.strategy ??
      factors.find((f) => f.strategy === "email_link")?.strategy ??
      factors.find((f) => f.strategy === "phone_code")?.strategy ??
      null;

    if (!strategy) {
      setError("This device needs extra verification, but no verification method is available. Please contact support.");
      return;
    }

    await signIn.prepareSecondFactor({ strategy });
    setTrustStrategy(strategy);
    setStep("client-trust");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace(redirect);
      } else if (result.status === "needs_client_trust") {
        await startClientTrustVerification(result);
      } else if (result.status === "needs_second_factor") {
        setError("This account requires a second verification step, which isn't supported here yet. Please contact support.");
      } else if (result.status === "needs_new_password") {
        setError("You need to set a new password before signing in. Please use \"Forgot password?\" below.");
      } else {
        // Most common cause: this email was registered via Google, so it has
        // no password factor and Clerk can't complete a password sign-in for it.
        const factors: { strategy?: string }[] = result.supportedFirstFactors ?? [];
        const hasPassword = factors.some((f) => f.strategy === "password");
        const hasGoogle = factors.some((f) => f.strategy === "oauth_google");
        if (!hasPassword && hasGoogle) {
          setError("This email is linked to a Google account. Please use \"Continue with Google\" instead.");
        } else {
          setError("Sign-in incomplete. Please try again.");
        }
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr?.errors?.[0]?.message ?? "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTrustCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || !trustStrategy) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.attemptSecondFactor({ strategy: trustStrategy, code: trustCode });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace(redirect);
      } else {
        setError("Couldn't verify that code. Please check it and try again.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr?.errors?.[0]?.message ?? "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendTrustCode = async () => {
    if (!isLoaded || !signIn || !trustStrategy) return;
    setError(null);
    try {
      await signIn.prepareSecondFactor({ strategy: trustStrategy });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr?.errors?.[0]?.message ?? "Could not resend code. Please try again.");
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clerkInstance = (window as any).Clerk;
      if (!clerkInstance?.loaded) {
        setError("Authentication not ready. Please refresh and try again.");
        return;
      }
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", redirect);
      await clerkInstance.client.signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: callbackUrl.toString(),
        redirectUrlComplete: redirect,
      });
    } catch (err: unknown) {
      console.error("Google OAuth error:", err);
      const clerkErr = err as { errors?: { message: string }[]; message?: string };
      setError(clerkErr?.errors?.[0]?.message ?? clerkErr?.message ?? String(err));
    }
  };

  if (step === "client-trust") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <Image src="/logo.png" alt="ScholarHub Logo" width={28} height={28} className={styles.logoImage} />
            <span className={styles.logoText}>ScholarHub</span>
          </div>
          <h1 className={styles.heading}>Verify it&apos;s you</h1>
          <p className={styles.sub}>
            We don&apos;t recognize this device. We sent a code to <strong>{email}</strong> to confirm it&apos;s really you.
          </p>

          <form onSubmit={handleTrustCodeSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="trust-code">Verification code</label>
              <input
                id="trust-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={trustCode}
                onChange={(e) => { setTrustCode(e.target.value); setError(null); }}
                placeholder="123456"
                maxLength={6}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primaryBtn} disabled={loading || !isLoaded}>
              {loading ? "Verifying…" : "Verify and sign in"}
            </button>
          </form>

          <p className={styles.switchLink}>
            <button
              type="button"
              style={{ background: "none", border: "none", color: "var(--teal-600)", cursor: "pointer", padding: 0, font: "inherit" }}
              onClick={handleResendTrustCode}
            >
              Resend code
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="ScholarHub Logo" width={28} height={28} className={styles.logoImage} />
          <span className={styles.logoText}>ScholarHub</span>
        </div>
        <h1 className={styles.heading}>{t("login.heading")}</h1>
        <p className={styles.sub}>{t("login.sub")}</p>

        <button type="button" onClick={handleGoogleSignIn} className={styles.googleBtn}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t("login.continueWithGoogle")}
        </button>

        <div className={styles.divider}>OR</div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email">{t("login.email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className={styles.field}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label htmlFor="password">{t("login.password")}</label>
              <Link href="/auth/forgot-password" style={{ fontSize: "0.8rem", color: "var(--teal-600)" }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.primaryBtn} disabled={loading || !isLoaded}>
            {loading ? t("login.signingIn") : t("login.signIn")}
          </button>
        </form>

        <p className={styles.switchLink}>
          {t("login.noAccount")}{" "}
          <Link href="/auth/signup">{t("login.createOne")}</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
