import { SiteHeader } from "@/components/site-header";
import styles from "@/components/auth/auth.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.surface}>
      <SiteHeader />
      <div className={styles.content}>{children}</div>
    </main>
  );
}
