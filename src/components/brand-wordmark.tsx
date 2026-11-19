import styles from "./brand-wordmark.module.css";

export function BrandWordmark() {
  return (
    <span className={styles.wordmark} role="img" aria-label="Auxillium">
      <span className={styles.symbol} aria-hidden="true" />
      <span aria-hidden="true">uxillium</span>
    </span>
  );
}
