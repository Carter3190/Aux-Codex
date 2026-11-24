import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalCurrentProfile, getRoleDashboardPath } from "@/lib/auth/profile";
import { hasProviderAccess } from "@/lib/auth/access";
import { SiteHeader } from "@/components/site-header";
import { ProviderApplicationStart } from "@/components/provider/provider-application-start";
import styles from "@/components/site-design.module.css";

export const metadata: Metadata = { title: "Offer services" };

export default async function OfferServicesPage() {
  const profile = await getOptionalCurrentProfile();
  if (!profile) redirect("/signup?role=provider");
  if (hasProviderAccess(profile)) redirect("/dashboard/provider/onboarding");
  if (profile.role !== "customer") redirect(getRoleDashboardPath(profile.role));
  return <main className={styles.surface}>
    <SiteHeader />
    <div className={`${styles.container} ${styles.narrow} ${styles.stack}`}>
      <div><p className={styles.kicker}>Provider application</p><h1 className={styles.title}>Offer services</h1><p className={styles.description}>Use your existing account to apply as a provider.</p></div>
      <section className={`${styles.card} ${styles.stack}`}>
        <h2>Start your provider application</h2>
        <p className={styles.description}>Your customer bookings, payments, and conversations will stay in this account. You can switch between your customer and provider dashboards.</p>
        <p className={styles.description}>We’ll review your application before you can accept booking requests.</p>
        <ProviderApplicationStart />
      </section>
    </div>
  </main>;
}
