import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { getOptionalCurrentProfile, getRoleDashboardPath } from "@/lib/auth/profile";
import { safeDashboardReturnPath } from "@/lib/auth/return-path";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Create account",
};

type SignupPageProps = {
  searchParams: Promise<{ role?: string; next?: string | string[] }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { role, next } = await searchParams;
  const nextPath = safeDashboardReturnPath(next);
  const profile = await getOptionalCurrentProfile();
  if (profile) {
    redirect(role === "provider" && profile.role === "customer"
      ? "/offer-services"
      : nextPath ?? getRoleDashboardPath(profile.role));
  }
  const defaultRole = role === "provider" ? "provider" : "customer";

  return (
    <section className={styles.card}>
      <p className={styles.kicker}>
        Get started
      </p>
      <h1 className={styles.title}>
        Create your account
      </h1>
      <SignupForm defaultRole={defaultRole} nextPath={nextPath ?? undefined} />
    </section>
  );
}
