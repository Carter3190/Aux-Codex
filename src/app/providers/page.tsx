import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { ProviderCard } from "@/components/marketplace/provider-card";
import styles from "@/components/marketplace/provider-directory.module.css";
import { getOptionalCurrentProfile } from "@/lib/auth/profile";
import { searchApprovedProviders } from "@/lib/marketplace/data";

export const metadata: Metadata = {
  title: "Find local providers",
  description:
    "Find local providers, explore their profiles, and request your next service through Auxilium.",
};

type ProvidersPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    area?: string | string[];
  }>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const params = await searchParams;
  const search = firstValue(params.q).trim().slice(0, 100);
  const area = firstValue(params.area).trim().slice(0, 100);
  const [profile, providers] = await Promise.all([
    getOptionalCurrentProfile(),
    searchApprovedProviders({ search, area }),
  ]);

  return (
    <main className={styles.page}>
      <MarketplaceHeader profile={profile} />
      <div className={styles.content}>
        <section aria-labelledby="provider-search-title">
          <p className={styles.eyebrow}>Customer marketplace</p>
          <h1 id="provider-search-title" className={styles.title}>
            Find local help near you.
          </h1>
          <form
            action="/providers"
            method="get"
            role="search"
            aria-label="Search providers"
            className={styles.searchForm}
          >
            <label className={styles.field}>
              Service or provider
              <input
                type="search"
                name="q"
                defaultValue={search}
                maxLength={100}
                className={styles.input}
                placeholder="What are you looking for?"
              />
            </label>
            <label className={styles.field}>
              Service area
              <input
                type="search"
                name="area"
                defaultValue={area}
                maxLength={100}
                className={styles.input}
                placeholder="City or community"
              />
            </label>
            <button type="submit" className={styles.searchButton}>
              Search
            </button>
          </form>
        </section>

        <section aria-labelledby="provider-results-title">
          <div className={styles.resultsHeading}>
            <div>
              <h2 id="provider-results-title" className={styles.resultsTitle}>
                Listed professionals
              </h2>
              <p className={styles.resultCount} role="status">
                {providers.length === 1
                  ? "1 provider found"
                  : `${providers.length} providers found`}
              </p>
            </div>
            {(search || area) && (
              <Link href="/providers" className={styles.clearLink}>
                Clear search
              </Link>
            )}
          </div>
          {providers.length > 0 ? (
            <div className={styles.providerList}>
              {providers.map((provider) => (
                <ProviderCard key={provider.providerId} provider={provider} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>No matching providers yet</h3>
              <p>
                Try a different search or location, or check back as more providers join Auxilium.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
