import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import styles from "@/components/site-design.module.css";

const steps = [
  { icon: "browse", title: "Find the right provider", body: "Explore profiles, services, and availability." },
  { icon: "messages", title: "Discuss the details", body: "Share what you need and confirm the price together." },
  { icon: "calendar", title: "Keep it together", body: "Manage the booking, payment, and conversation from your account." },
] as const;

export default function Home() {
  return <main className={styles.surface}>
    <SiteHeader />
    <div className={`${styles.container} ${styles.stack}`}>
      <div className={styles.featured}>
        <section className={`${styles.card} ${styles.hero}`}>
          <p className={styles.kicker}>Local help, made human</p>
          <h1 className={styles.title}>Good work should be easier to find.</h1>
          <p className={styles.description}>Find local help, keep the details organized, and stay connected with your provider.</p>
          <div className={styles.row}><Link href="/providers" className={styles.primaryButton}>Find a Provider <CustomerIcon name="arrow" /></Link><Link href="/signup?role=provider" className={styles.secondaryButton}>Offer your services</Link></div>
        </section>
        <section className={`${styles.card} ${styles.stack}`} aria-labelledby="how-title">
          <div><p className={styles.kicker}>From request to visit</p><h2 id="how-title">A clear next step.</h2></div>
          <ol className={styles.steps}>{steps.map((step) => <li key={step.title}><span className={styles.iconTile}><CustomerIcon name={step.icon} /></span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
        </section>
      </div>
      <section id="about" className={`${styles.about} ${styles.stack}`} aria-labelledby="about-title">
        <div><p className={styles.kicker}>About Auxilium</p><h2 id="about-title">More time for what matters.</h2></div>
        <div className={styles.grid2}>
          <article className={`${styles.card} ${styles.actionCard}`}><span className={styles.iconTile}><CustomerIcon name="overview" /></span><h3>A simpler way to arrange help</h3><p>Find a provider in your community and keep requests, messages, and booking details in one place.</p><Link href="/signup?role=customer" className={styles.secondaryButton}>Create a customer account</Link></article>
          <article className={`${styles.card} ${styles.actionCard}`}><span className={styles.iconTile}><CustomerIcon name="book" /></span><h3>A professional home for your work</h3><p>Introduce your business, submit your service information for review, and manage customer requests from your provider account.</p><Link href="/signup?role=provider" className={styles.secondaryButton}>Apply to offer services</Link></article>
        </div>
      </section>
      <aside className={styles.notice}><strong>Clear provider information.</strong> Review service descriptions, availability, and applicable approval labels before requesting a visit. We’re building our provider community with care.</aside>
    </div>
  </main>;
}
