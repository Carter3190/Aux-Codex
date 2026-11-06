import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BookingRequestForm } from "@/components/marketplace/booking-request-form";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import styles from "@/components/marketplace/provider-profile.module.css";
import { getOptionalCurrentProfile } from "@/lib/auth/profile";
import { getLegalAcceptanceStatus } from "@/lib/legal/data";
import { getApprovedProvider } from "@/lib/marketplace/data";
import type { PublicServiceCredentialCheck } from "@/lib/marketplace/types";
import { formatPrice, labelFromSnakeCase, weekdays } from "@/lib/providers/presentation";

export const metadata: Metadata = {
  title: "Provider profile",
};

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatProfileDate(date: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(date));
}

function ServiceCredentialCheck({ check }: { check?: PublicServiceCredentialCheck }) {
  if (!check?.eligible || !check.checkedAt) {
    return (
      <p className={styles.credentialCheckPending}>
        {check ? "Credential review needed before booking." : "Credential check information is currently unavailable."}
      </p>
    );
  }

  return (
    <div className={styles.credentialCheck}>
      <h4>Credentials checked by Auxilium</h4>
      <p className={styles.credentialMeta}>
        Service review completed <time dateTime={check.checkedAt}>{formatProfileDate(check.checkedAt, "America/Detroit")}</time>
      </p>
      <ul className={styles.credentialList}>
        {check.credentials.map((credential) => (
          <li key={credential.id}>
            <p className={styles.credentialName}>{credential.title}</p>
            <p className={styles.credentialMeta}>
              {labelFromSnakeCase(credential.type)}
              {credential.issuer && ` · ${credential.issuer}`}
            </p>
            <p className={styles.credentialMeta}>
              Checked <time dateTime={credential.checkedAt}>{formatProfileDate(credential.checkedAt, "America/Detroit")}</time>
              {credential.expiresOn && (
                <> · Expires <time dateTime={credential.expiresOn}>{formatProfileDate(credential.expiresOn, "UTC")}</time></>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
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

  if (profile?.role === "customer") {
    const legalStatus = await getLegalAcceptanceStatus(profile);
    if (!legalStatus.migrationReady || legalStatus.missing.length > 0) {
      redirect(
        `/legal/accept?next=${encodeURIComponent(`/providers/${provider.providerId}`)}`,
      );
    }
  }

  const serviceChecks = new Map(provider.serviceChecks.map((check) => [check.serviceId, check]));

  return (
    <main className={styles.page}>
      <MarketplaceHeader profile={profile} />

      <section className={styles.heroBand}>
        <div className={styles.heroInner}>
          <Link href="/providers" className={styles.backLink}>
            ← Back to providers
          </Link>
          <div className={styles.heroGrid}>
            <div className={styles.profilePhoto}>
              {provider.photos[0] ? (
                // Provider photos are served from Auxilium's public Supabase bucket.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={provider.photos[0].publicUrl}
                  alt={provider.photos[0].caption || provider.displayName}
                  className={styles.photoImage}
                />
              ) : (
                <div className={styles.photoFallback}>
                  {provider.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className={styles.heroCopy}>
              <div className={styles.heroLabels}>
                <p className={styles.eyebrow}>Listed provider</p>
                <span className={styles.reviewedBadge}>
                  {provider.bookingEligible ? "Booking requests open" : "Booking requests unavailable"}
                </span>
              </div>
              <h1 className={styles.providerName}>
                {provider.displayName}
              </h1>
              <p className={styles.headline}>{provider.headline}</p>
              {provider.reviewCount > 0 && provider.averageRating !== null && (
                <p className={styles.ratingSummary}>
                  <span className={styles.stars} aria-hidden="true">★</span>{" "}
                  {provider.averageRating.toFixed(1)} from {provider.reviewCount}{" "}
                  {provider.reviewCount === 1 ? "verified review" : "verified reviews"}
                </p>
              )}
              <p className={styles.providerMeta}>
                Serving {provider.serviceArea}
                {provider.travelRadiusMiles !== null && ` · Travels up to ${provider.travelRadiusMiles} miles`}
                {provider.yearsExperience !== null && ` · ${provider.yearsExperience} years of experience`}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.profileSections}>
          <section className={styles.panel}>
            <h2 className={styles.sectionTitle}>About</h2>
            <p className={styles.bio}>{provider.bio}</p>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>
                  Customer reviews
                </p>
                <h2 className={styles.sectionTitle}>
                  Verified Auxilium bookings
                </h2>
              </div>
              {provider.reviewCount > 0 && provider.averageRating !== null && (
                <p className={styles.ratingSummary}>
                  <span className={styles.stars} aria-hidden="true">★</span>{" "}
                  {provider.averageRating.toFixed(1)} · {provider.reviewCount}
                </p>
              )}
            </div>
            {provider.reviews.length > 0 ? (
              <div className={styles.reviewList}>
                {provider.reviews.map((review) => (
                  <article key={review.id} className={styles.review}>
                    <div className={styles.reviewTop}>
                      <div>
                        <p className={styles.stars} aria-label={`${review.rating} out of 5 stars`}>
                          {"★".repeat(review.rating)}
                          <span className={styles.emptyStars}>{"★".repeat(5 - review.rating)}</span>
                        </p>
                        <p className={styles.reviewerName}>
                          {review.reviewerName}
                        </p>
                      </div>
                      <span className={styles.reviewDate}>
                        {formatProfileDate(review.createdAt)}
                      </span>
                    </div>
                    <p className={styles.reviewBody}>
                      {review.body}
                    </p>
                    <p className={styles.verifiedBooking}>
                      ✓ Verified booking · {review.serviceName}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyCopy}>
                This provider has not received a verified customer review yet.
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.sectionTitle}>Services</h2>
            <div className={styles.serviceList}>
              {provider.services.map((service) => (
                <article key={service.id} className={styles.service}>
                  <div className={styles.serviceHeading}>
                    <h3>{service.name}</h3>
                    <span className={styles.servicePrice}>
                      {formatPrice(service.pricingType, service.priceCents)}
                    </span>
                  </div>
                  {service.description && <p className={styles.serviceDescription}>{service.description}</p>}
                  <ServiceCredentialCheck check={serviceChecks.get(service.id)} />
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.sectionTitle}>Typical availability</h2>
            <ul className={styles.availabilityList}>
              {provider.availability.map((day) => (
                <li key={day.weekday}>
                  <span>{weekdays[day.weekday]}</span>
                  <span className={styles.availabilityTime}>{day.startTime}–{day.endTime}</span>
                </li>
              ))}
            </ul>
          </section>

          {provider.photos.length > 1 && (
            <section className={styles.gallerySection}>
              <h2 className={styles.sectionTitle}>Work & profile photos</h2>
              <div className={styles.photoGrid}>
                {provider.photos.slice(1).map((photo) => (
                  <figure key={photo.id} className={styles.workPhoto}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.publicUrl} alt={photo.caption || provider.displayName} className={styles.workImage} />
                    {photo.caption && <figcaption className={styles.photoCaption}>{photo.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className={styles.bookingPanel}>
          <p className={styles.eyebrow}>{provider.bookingEligible ? "Request a booking" : "Booking availability"}</p>
          <h2 className={styles.bookingTitle}>
            {provider.bookingEligible ? `Tell ${provider.displayName} what you need.` : "New requests are unavailable"}
          </h2>
          {provider.bookingEligible && (
            <p className={styles.bookingIntro}>
              The provider reviews your request before confirming the booking. The service’s required credentials must be current on the date you request.
            </p>
          )}

          <div className={styles.bookingForm}>
            {!provider.bookingEligible ? (
              <div className={styles.bookingUnavailable}>
                Check back for booking availability after Auxilium reviews the required credentials.
              </div>
            ) : profile?.role === "customer" ? (
              <BookingRequestForm
                providerId={provider.providerId}
                providerName={provider.displayName}
                services={provider.bookableServices}
                minimumDate={tomorrowDate()}
              />
            ) : profile ? (
              <div className={styles.accountNotice}>
                Booking requests must be sent from a customer account. Your current account is a {profile.role} account.
              </div>
            ) : (
              <div className={styles.signInActions}>
                <Link href="/login" className={styles.primaryButton}>
                  Sign in to request
                </Link>
                <Link href="/signup?role=customer" className={styles.secondaryButton}>
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
