import Link from "next/link";
import { formatPrice } from "@/lib/providers/presentation";
import type { MarketplaceProviderCard } from "@/lib/marketplace/types";

export function ProviderCard({ provider }: { provider: MarketplaceProviderCard }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-white shadow-[0_14px_40px_rgba(22,60,45,0.06)]">
      <div className="grid h-full sm:grid-cols-[210px_1fr]">
        <div className="min-h-52 bg-[#e7eee8]">
          {provider.primaryPhotoUrl ? (
            // Provider photos are served from Auxilium's public Supabase bucket.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={provider.primaryPhotoUrl}
              alt={provider.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-52 items-center justify-center text-5xl font-semibold text-brand/40">
              {provider.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                Approved provider
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-brand-dark">
                {provider.displayName}
              </h2>
            </div>
            <span className="rounded-full bg-[#eef8f2] px-3 py-1.5 text-xs font-bold text-brand">
              ✓ Verified
            </span>
          </div>
          <p className="mt-2 font-medium text-foreground">{provider.headline}</p>
          <p className="mt-3 text-sm text-muted">Serving {provider.serviceArea}</p>
          <p className="mt-4 line-clamp-3 leading-7 text-muted">
            {provider.bioPreview}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {provider.services.slice(0, 4).map((service) => (
              <span
                key={service.id}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                {service.name} · {formatPrice(service.pricingType, service.priceCents)}
              </span>
            ))}
          </div>
          <div className="mt-auto pt-6">
            <Link
              href={`/providers/${provider.providerId}`}
              className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              View profile & request booking
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
