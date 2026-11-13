import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { safeDashboardReturnPath } from "@/lib/auth/return-path";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const nextPath = safeDashboardReturnPath((await searchParams).next);
  return (
    <section className={styles.card}>
      <p className={styles.kicker}>
        Welcome back
      </p>
      <h1 className={styles.title}>
        Sign in to Auxilium
      </h1>
      <p className={styles.description}>
        Access your bookings, profile, and conversations.
      </p>
      <LoginForm nextPath={nextPath ?? undefined} />
      <p className={styles.footnote}>
        New to Auxilium?{" "}
        <Link href="/signup" className={styles.textLink}>
          Create an account
        </Link>
      </p>
    </section>
  );
}
