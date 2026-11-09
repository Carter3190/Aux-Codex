import Link from "next/link";
import styles from "@/components/marketplace/provider-directory.module.css";
import type { MarketplaceProviderCard } from "@/lib/marketplace/types";

export function ProviderCard({ provider }: { provider: MarketplaceProviderCard }) {
  const initials = provider.displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <article className={styles.providerCard}>
      <div className={styles.identity}>
        <div className={styles.avatar}>
          {provider.primaryPhotoUrl ? (
            // Provider photos are served from Auxilium's public Supabase bucket.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={provider.primaryPhotoUrl} alt="" className={styles.avatarImage} />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </div>
        <div className={styles.identityCopy}>
          <h3 className={styles.providerName}>{provider.displayName}</h3>
          <div className={styles.providerMeta}>
            <span>{provider.serviceArea}</span>
            {provider.reviewCount > 0 && provider.averageRating !== null && (
              <span className={styles.rating}>
                <span aria-hidden="true">★</span>{" "}
                {provider.averageRating.toFixed(1)} · {provider.reviewCount}{" "}
                {provider.reviewCount === 1 ? "verified review" : "verified reviews"}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className={styles.summary}>{provider.headline || provider.bioPreview}</p>
      {provider.services.length > 0 && (
        <ul className={styles.services} aria-label="Services offered">
          {provider.services.slice(0, 4).map((service) => (
            <li key={service.id}>{service.name}</li>
          ))}
        </ul>
      )}
      <Link href={`/providers/${provider.providerId}`} className={styles.profileLink}>
        View provider profile <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
