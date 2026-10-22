"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs/legacy";
import styles from "../auth.module.css";

type Step = "email" | "code" | "password" | "done";

function ForgotPasswordForm() {
  const router = useRouter();
  const { signIn, isLoaded, setActive } = useSignIn() as any;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setError(null);
    setLoading(true);
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStep("code");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr?.errors?.[0]?.message ?? "Could not send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });
      if (result.status === "needs_new_password") {
        setStep("password");
      } else {
        setError("Unexpected response. Please try again.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr?.errors?.[0]?.message ?? "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await (signIn as any).resetPassword({ password: newPassword });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setStep("done");
        setTimeout(() => router.replace("/"), 2000);
      } else {
        setError("Could not reset password. Please try again.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr?.errors?.[0]?.message ?? "Password reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="ScholarHub Logo" width={28} height={28} className={styles.logoImage} />
          <span className={styles.logoText}>ScholarHub</span>
        </div>

        {step === "email" && (
          <>
            <h1 className={styles.heading}>Reset your password</h1>
            <p className={styles.sub}>Enter your email and we'll send you a reset code.</p>
            <form onSubmit={handleEmailSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email">Email address</label>
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
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.primaryBtn} disabled={loading || !isLoaded}>
                {loading ? "Sending…" : "Send reset code"}
              </button>
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <h1 className={styles.heading}>Check your email</h1>
            <p className={styles.sub}>We sent a 6-digit code to <strong>{email}</strong>.</p>
            <form onSubmit={handleCodeSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="code">Reset code</label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.primaryBtn} disabled={loading || !isLoaded}>
                {loading ? "Verifying…" : "Verify code"}
              </button>
            </form>
            <p className={styles.switchLink}>
              Wrong email?{" "}
              <button type="button" style={{ background: "none", border: "none", color: "var(--teal-600)", cursor: "pointer", padding: 0 }} onClick={() => { setStep("email"); setError(null); }}>
                Go back
              </button>
            </p>
          </>
        )}

        {step === "password" && (
          <>
            <h1 className={styles.heading}>Set a new password</h1>
            <p className={styles.sub}>Choose a strong password for your account.</p>
            <form onSubmit={handlePasswordSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.primaryBtn} disabled={loading || !isLoaded}>
                {loading ? "Saving…" : "Set new password"}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <h1 className={styles.heading}>Password updated!</h1>
            <p className={styles.sub}>Your password has been reset. Redirecting you to your dashboard…</p>
          </>
        )}

        <p className={styles.switchLink}>
          <Link href="/auth/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
