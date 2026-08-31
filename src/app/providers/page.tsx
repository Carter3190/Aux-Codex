import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { getOptionalCurrentProfile } from "@/lib/auth/profile";
import { searchApprovedProviders } from "@/lib/marketplace/data";

export const metadata: Metadata = {
  title: "Find local providers",
  description: "Browse approved local service providers on Auxilium.",
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
    <main className="min-h-screen bg-background">
      <MarketplaceHeader profile={profile} />

      <section className="border-b border-border bg-[#eef5f0]">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">
            Customer marketplace
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-brand-dark sm:text-5xl">
            Find trusted help near you.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
            Every provider shown here has completed Auxilium’s application and approval process.
          </p>

          <form
            action="/providers"
            method="get"
            className="mt-8 grid gap-3 rounded-3xl border border-white bg-white/90 p-4 shadow-[0_18px_50px_rgba(22,60,45,0.08)] md:grid-cols-[1fr_1fr_auto]"
          >
            <label className="text-sm font-semibold text-foreground">
              Service or provider
              <input
                name="q"
                defaultValue={search}
                maxLength={100}
                className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                placeholder="Roofing, tutoring, lawn care…"
              />
            </label>
            <label className="text-sm font-semibold text-foreground">
              Service area
              <input
                name="area"
                defaultValue={area}
                maxLength={100}
                className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                placeholder="City or community"
              />
            </label>
            <button
              type="submit"
              className="self-end rounded-full bg-brand px-7 py-3 font-semibold text-white transition hover:bg-brand-dark"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
              Approved professionals
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-brand-dark">
              {providers.length === 1
                ? "1 provider found"
                : `${providers.length} providers found`}
            </h2>
          </div>
          {(search || area) && (
            <Link href="/providers" className="text-sm font-semibold text-brand hover:text-brand-dark">
              Clear search
            </Link>
          )}
        </div>

        {providers.length > 0 ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            {providers.map((provider) => (
              <ProviderCard key={provider.providerId} provider={provider} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-border bg-white p-8 text-center sm:p-12">
            <h2 className="text-2xl font-semibold text-brand-dark">No matching providers yet</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-muted">
              Try a broader service or location. Auxilium will show more professionals as applications are approved.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
