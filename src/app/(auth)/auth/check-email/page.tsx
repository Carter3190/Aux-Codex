import type { Metadata } from "next";
import Link from "next/link";
import { EmailIcon } from "@/components/auth/email-icon";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <section className={styles.card}>
      <EmailIcon />
      <p className={styles.kicker}>Email confirmation</p>
      <h1 className={styles.title}>Check your email</h1>
      <p className={styles.description}>We sent a confirmation link. Open it to verify your email and finish creating your Auxilium account.</p>
      <div className={styles.notice}>If you don’t see the message, check your spam or promotions folder.</div>
      <div className={styles.actions}><Link href="/login" className={styles.secondary}>Return to sign in</Link></div>
      <p className={styles.footnote}>Need another link? Enter the same email you used to create your account.</p>
      <ResendConfirmationForm />
      <p className={styles.footnote}>Need a hand? <Link href="/support" className={styles.textLink}>Contact support</Link></p>
    </section>
  );
}
