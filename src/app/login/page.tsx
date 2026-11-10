"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, LockKeyhole } from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Sign-in failed. Please try again.");
        return;
      }
      const target = new URLSearchParams(window.location.search).get("next");
      const returnTo = target?.startsWith("/") && !target.startsWith("//") && !target.includes("\\") ? target : "/";
      router.replace(returnTo);
      router.refresh();
    } catch {
      setError("The sign-in service could not be reached. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.brand}>
          <span className={styles.brandIcon}><FileText size={20} strokeWidth={2} aria-hidden="true" /></span>
          <span className={styles.brandText}><strong>ClearPDF</strong><small>SMART PDF PROCESSING</small></span>
        </div>

        <div className={styles.intro}>
          <span className={styles.lockIcon}><LockKeyhole size={17} aria-hidden="true" /></span>
          <p className={styles.eyebrow}>PRIVATE DOCUMENT WORKSPACE</p>
          <h1 id="login-title">Welcome back</h1>
          <p className={styles.description}>Sign in to securely open your PDF workspace.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Username</span>
              <input
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                required
                maxLength={256}
                disabled={busy}
              />
            </label>
            <label className={styles.field}>
              <span>Password</span>
              <input
                autoComplete="current-password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                maxLength={1024}
                disabled={busy}
              />
            </label>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button className={styles.submit} type="submit" disabled={busy || !username || !password}>
              {busy ? <><span className={styles.spinner} aria-hidden="true" /> Signing in…</> : "Sign in"}
            </button>
            <p className={styles.privacy}>Your credentials stay on the server and are never placed in the page source.</p>
        </form>
      </section>
      <footer className={styles.footer}>ClearPDF <span>·</span> Secure document access</footer>
    </main>
  );
}
