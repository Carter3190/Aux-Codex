import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BookingRequestForm } from "@/components/marketplace/booking-request-form";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { getOptionalCurrentProfile } from "@/lib/auth/profile";
import { getApprovedProvider } from "@/lib/marketplace/data";
import { formatPrice, labelFromSnakeCase, weekdays } from "@/lib/providers/presentation";

export const metadata: Metadata = {
  title: "Provider profile",
};

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const parsedId = z.uuid().safeParse(providerId);
  if (!parsedId.success) notFound();

  const [provider, profile] = await Promise.all([
    getApprovedProvider(parsedId.data),
    getOptionalCurrentProfile(),
  ]);
  if (!provider) notFound();

  return (
    <main className="min-h-screen bg-background">
      <MarketplaceHeader profile={profile} />

      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
          <Link href="/providers" className="text-sm font-semibold text-brand hover:text-brand-dark">
            ← Back to providers
          </Link>
          <div className="mt-7 grid gap-8 lg:grid-cols-[300px_1fr] lg:items-center">
            <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-[#e7eee8] lg:aspect-square">
              {provider.photos[0] ? (
                // Provider photos are served from Auxilium's public Supabase bucket.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={provider.photos[0].publicUrl}
                  alt={provider.photos[0].caption || provider.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-7xl font-semibold text-brand/40">
                  {provider.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-bold uppercase tracking-[0.17em] text-brand">Approved provider</p>
                <span className="rounded-full bg-[#eef8f2] px-3 py-1 text-xs font-bold text-brand">✓ Verified</span>
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-brand-dark sm:text-5xl">
                {provider.displayName}
              </h1>
              <p className="mt-3 text-xl font-medium text-foreground">{provider.headline}</p>
              <p className="mt-4 text-muted">
                Serving {provider.serviceArea}
                {provider.travelRadiusMiles !== null && ` · Travels up to ${provider.travelRadiusMiles} miles`}
                {provider.yearsExperience !== null && ` · ${provider.yearsExperience} years of experience`}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_420px] lg:px-10 lg:py-16">
        <div className="space-y-8">
          <section className="rounded-3xl border border-border bg-white p-7 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">About</p>
            <p className="mt-4 whitespace-pre-wrap text-lg leading-8 text-muted">{provider.bio}</p>
          </section>

          <section className="rounded-3xl border border-border bg-white p-7 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">Services</p>
            <div className="mt-5 divide-y divide-border">
              {provider.services.map((service) => (
                <article key={service.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold text-brand-dark">{service.name}</h2>
                    <span className="font-semibold text-brand">
                      {formatPrice(service.pricingType, service.priceCents)}
                    </span>
                  </div>
                  {service.description && <p className="mt-2 leading-7 text-muted">{service.description}</p>}
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-white p-7">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">Typical availability</p>
              <ul className="mt-5 space-y-3">
                {provider.availability.map((day) => (
                  <li key={day.weekday} className="flex justify-between gap-4 text-sm">
                    <span className="font-semibold text-foreground">{weekdays[day.weekday]}</span>
                    <span className="text-muted">{day.startTime}–{day.endTime}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-border bg-white p-7">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">Reviewed credentials</p>
              {provider.credentials.length > 0 ? (
                <ul className="mt-5 space-y-4">
                  {provider.credentials.map((credential) => (
                    <li key={credential.id}>
                      <p className="font-semibold text-foreground">{credential.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {labelFromSnakeCase(credential.type)}
                        {credential.issuer && ` · ${credential.issuer}`}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 leading-7 text-muted">Auxilium reviewed this provider’s private application documents.</p>
              )}
            </div>
          </section>

          {provider.photos.length > 1 && (
            <section>
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">Work & profile photos</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {provider.photos.slice(1).map((photo) => (
                  <figure key={photo.id} className="overflow-hidden rounded-3xl border border-border bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.publicUrl} alt={photo.caption || provider.displayName} className="aspect-[4/3] w-full object-cover" />
                    {photo.caption && <figcaption className="p-4 text-sm text-muted">{photo.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-3xl border border-border bg-white p-6 shadow-[0_20px_60px_rgba(22,60,45,0.08)] lg:sticky lg:top-6 sm:p-7">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">Request a booking</p>
          <h2 className="mt-2 text-2xl font-semibold text-brand-dark">Tell {provider.displayName} what you need.</h2>
          <p className="mt-3 text-sm leading-6 text-muted">This sends a request, not an automatic confirmation. The provider will accept or decline it.</p>

          <div className="mt-6">
            {profile?.role === "customer" ? (
              <BookingRequestForm providerId={provider.providerId} services={provider.services} minimumDate={tomorrowDate()} />
            ) : profile ? (
              <div className="rounded-2xl bg-background p-5 text-sm leading-6 text-muted">
                Booking requests must be sent from a customer account. Your current account is a {profile.role} account.
              </div>
            ) : (
              <div className="space-y-3">
                <Link href="/login" className="block rounded-full bg-brand px-6 py-3 text-center font-semibold text-white hover:bg-brand-dark">
                  Sign in to request
                </Link>
                <Link href="/signup?role=customer" className="block rounded-full border border-border px-6 py-3 text-center font-semibold text-brand-dark hover:border-brand">
                  Create customer account
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
