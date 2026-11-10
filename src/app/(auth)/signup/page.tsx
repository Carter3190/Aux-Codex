import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Create account",
};

type SignupPageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { role } = await searchParams;
  const defaultRole = role === "provider" ? "provider" : "customer";

  return (
    <section className={styles.card}>
      <p className={styles.kicker}>
        Get started
      </p>
      <h1 className={styles.title}>
        Create your account
      </h1>
      <SignupForm defaultRole={defaultRole} />
      <p className={styles.footnote}>
        Already have an account?{" "}
        <Link href="/login" className={styles.textLink}>
          Sign in
        </Link>
      </p>
    </section>
  );
}
