import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
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
      <LoginForm />
      <p className={styles.footnote}>
        New to Auxilium?{" "}
        <Link href="/signup" className={styles.textLink}>
          Create an account
        </Link>
      </p>
    </section>
  );
}
