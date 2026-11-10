import type { Metadata } from "next";
import Link from "next/link";
import { EmailIcon } from "@/components/auth/email-icon";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = { title: "Email confirmation" };

export default function AuthErrorPage() {
  return (
    <section className={styles.card}>
      <EmailIcon issue />
      <p className={styles.kicker}>Email confirmation</p>
      <h1 className={styles.title}>We couldn’t confirm your email</h1>
      <p className={styles.description}>The link may have expired, already been used, or be incomplete. Enter the email address you used to create your account to request a new link.</p>
      <ResendConfirmationForm />
      <div className={styles.notice}>Check your spam folder and use the newest confirmation email.</div>
      <p className={styles.footnote}>Already confirmed your email? <Link href="/login" className={styles.textLink}>Sign in</Link></p>
      <p className={styles.footnote}>Need a hand? <Link href="/support" className={styles.textLink}>Contact support</Link></p>
    </section>
  );
}
