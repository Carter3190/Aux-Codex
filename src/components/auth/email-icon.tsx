import styles from "./auth.module.css";

export function EmailIcon({ issue = false }: { issue?: boolean }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M2 6l9 7 9-7" />
        {issue ? <path d="m17 17 5 5m0-5-5 5" /> : <path d="m16 19 2 2 4-5" />}
      </svg>
    </span>
  );
}
