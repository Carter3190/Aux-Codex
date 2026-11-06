import "server-only";

import { redirect } from "next/navigation";
import { requireRole, type ProviderStatus } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminProviderApplication,
  AdminProviderCredential,
  AdminProviderService,
  CredentialReviewStatus,
  CredentialType,
  PricingType,
  ProviderAvailability,
  ProviderCompletion,
  ProviderCredential,
  ProviderDetails,
  ProviderPhoto,
  ProviderReviewEvent,
  ProviderService,
  ProviderWorkspace,
} from "./types";

type DetailsRow = {
  provider_id: string;
  business_name: string;
  headline: string;
  bio: string;
  years_experience: number | null;
  service_area: string;
  travel_radius_miles: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

type ServiceRow = {
  id: string;
  provider_id: string;
  name: string;
  description: string;
  pricing_type: PricingType;
  price_cents: number | null;
  is_active: boolean;
};

type AvailabilityRow = {
  provider_id: string;
  weekday: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
};

type PhotoRow = {
  id: string;
  provider_id: string;
  storage_path: string;
  caption: string;
  sort_order: number;
};

type CredentialRow = {
  id: string;
  provider_id: string;
  credential_type: CredentialType;
  title: string;
  issuer: string;
  credential_number: string;
  expires_on: string | null;
  document_path: string;
  review_status: CredentialReviewStatus;
  review_notes: string;
};

type ReviewRow = {
  id: string;
  provider_id: string;
  decision: "approved" | "rejected";
  notes: string;
  created_at: string;
};

type AdminProfileRow = {
  id: string;
  email: string;
  full_name: string;
  provider_status: ProviderStatus;
  created_at: string;
};

type AdminDetailsRow = DetailsRow & { updated_at: string };
type AdminServiceRow = ServiceRow & { updated_at: string };
type AdminCredentialRow = CredentialRow & {
  reviewed_at: string | null;
  reviewed_by: string | null;
};
type ServiceCredentialReviewRow = {
  service_id: string;
  license_required: boolean;
  license_credential_ids: string[];
  insurance_credential_ids: string[];
  reviewed_at: string;
  reviewed_by: string;
};

function migrationMissing(code?: string) {
  return code === "42P01" || code === "42703" || code === "PGRST204";
}
function mapDetails(row: DetailsRow): ProviderDetails {
  return {
    providerId: row.provider_id,
    businessName: row.business_name,
    headline: row.headline,
    bio: row.bio,
    yearsExperience: row.years_experience,
    serviceArea: row.service_area,
    travelRadiusMiles: row.travel_radius_miles,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

function mapService(row: ServiceRow): ProviderService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pricingType: row.pricing_type,
    priceCents: row.price_cents,
    isActive: row.is_active,
  };
}

function mapAvailability(row: AvailabilityRow): ProviderAvailability {
  return {
    weekday: row.weekday,
    isAvailable: row.is_available,
    startTime: row.start_time?.slice(0, 5) ?? null,
    endTime: row.end_time?.slice(0, 5) ?? null,
  };
}

function mapPhoto(row: PhotoRow, publicUrl: string): ProviderPhoto {
  return {
    id: row.id,
    storagePath: row.storage_path,
    publicUrl,
    caption: row.caption,
    sortOrder: row.sort_order,
  };
}

function mapCredential(
  row: CredentialRow,
  documentUrl?: string | null,
): ProviderCredential {
  return {
    id: row.id,
    credentialType: row.credential_type,
    title: row.title,
    issuer: row.issuer,
    credentialNumber: row.credential_number,
    expiresOn: row.expires_on,
    documentPath: row.document_path,
    documentUrl,
    reviewStatus: row.review_status,
    reviewNotes: row.review_notes,
  };
}

function mapAdminCredential(
  row: AdminCredentialRow,
  documentUrl: string | null,
  today: string,
  adminReviewerIds: ReadonlySet<string>,
): AdminProviderCredential {
  const individuallyApproved =
    row.review_status === "approved" &&
    Boolean(row.reviewed_at && row.reviewed_by && adminReviewerIds.has(row.reviewed_by) &&
      row.issuer.trim() && documentUrl && row.document_path.startsWith(`${row.provider_id}/`));
  const hasCurrentExpiry = row.expires_on !== null && row.expires_on >= today;
  return {
    ...mapCredential(row, documentUrl),
    eligibleForServiceReview: individuallyApproved && (
      (row.credential_type === "insurance" && hasCurrentExpiry) ||
      (row.credential_type === "license" && (hasCurrentExpiry || row.expires_on === null))
    ),
  };
}

function mapAdminService(
  row: AdminServiceRow,
  review: ServiceCredentialReviewRow | undefined,
  eligible: ReadonlyMap<string, CredentialType>,
): AdminProviderService {
  return {
    ...mapService(row),
    updatedAt: row.updated_at,
    credentialReview: review ? {
      licenseRequired: review.license_required,
      licenseCredentialIds: review.license_credential_ids,
      insuranceCredentialIds: review.insurance_credential_ids,
      reviewedAt: review.reviewed_at,
    } : null,
    credentialReviewCurrent: Boolean(row.is_active && review?.reviewed_by && review.reviewed_at &&
      review.insurance_credential_ids.length > 0 &&
      review.insurance_credential_ids.every((id) => eligible.get(id) === "insurance") &&
      (review.license_required
        ? review.license_credential_ids.length > 0 &&
          review.license_credential_ids.every((id) => eligible.get(id) === "license")
        : review.license_credential_ids.length === 0)),
  };
}

function mapReview(row: ReviewRow): ProviderReviewEvent {
  return {
    id: row.id,
    decision: row.decision,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function calculateProviderCompletion(input: {
  providerStatus: ProviderStatus;
  details: ProviderDetails;
  services: ProviderService[];
  availability: ProviderAvailability[];
  photos: ProviderPhoto[];
  credentials: ProviderCredential[];
}): ProviderCompletion {
  const currentInsurance = hasCurrentInsuranceCredential(input.credentials);
  const checks = {
    introduction:
      input.details.headline.trim().length >= 10 &&
      input.details.bio.trim().length >= 80 &&
      input.details.serviceArea.trim().length >= 2,
    services: input.services.some((service) => service.isActive),
    photos: input.photos.length > 0,
    credentials:
      input.providerStatus === "approved" || currentInsurance,
    availability: input.availability.some((day) => day.isAvailable),
  };
  const values = Object.values(checks);
  const completedCount = values.filter(Boolean).length;

  return {
    ...checks,
    completedCount,
    totalCount: values.length,
    percentage: Math.round((completedCount / values.length) * 100),
    isComplete: completedCount === values.length,
  };
}

export function hasCurrentInsuranceCredential(
  credentials: ProviderCredential[],
  requireApproved = false,
) {
  const today = new Date().toISOString().slice(0, 10);
  return credentials.some(
    (credential) =>
      credential.credentialType === "insurance" &&
      credential.issuer.trim().length > 0 &&
      credential.expiresOn !== null &&
      credential.expiresOn >= today &&
      (!requireApproved || credential.reviewStatus === "approved"),
  );
}

function emptyAvailability(): ProviderAvailability[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    isAvailable: false,
    startTime: null,
    endTime: null,
  }));
}

function mergeAvailability(rows: AvailabilityRow[]) {
  const byDay = new Map(rows.map((row) => [row.weekday, mapAvailability(row)]));
  return emptyAvailability().map((day) => byDay.get(day.weekday) ?? day);
}

function publicPhotoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
) {
  return supabase.storage.from("provider-photos").getPublicUrl(path).data
    .publicUrl;
}

export async function getProviderWorkspace(): Promise<ProviderWorkspace> {
  const profile = await requireRole("provider");
  const supabase = await createClient();

  const [detailsResult, servicesResult, availabilityResult, photosResult, credentialsResult, reviewsResult] =
    await Promise.all([
      supabase
        .from("provider_details")
        .select(
          "provider_id, business_name, headline, bio, years_experience, service_area, travel_radius_miles, submitted_at, reviewed_at",
        )
        .eq("provider_id", profile.id)
        .single(),
      supabase
        .from("provider_services")
        .select(
          "id, provider_id, name, description, pricing_type, price_cents, is_active",
        )
        .eq("provider_id", profile.id)
        .order("created_at"),
      supabase
        .from("provider_availability")
        .select(
          "provider_id, weekday, is_available, start_time, end_time",
        )
        .eq("provider_id", profile.id)
        .order("weekday"),
      supabase
        .from("provider_photos")
        .select("id, provider_id, storage_path, caption, sort_order")
        .eq("provider_id", profile.id)
        .order("sort_order"),
      supabase
        .from("provider_credentials")
        .select(
          "id, provider_id, credential_type, title, issuer, credential_number, expires_on, document_path, review_status, review_notes",
        )
        .eq("provider_id", profile.id)
        .order("created_at"),
      supabase
        .from("provider_review_events")
        .select("id, provider_id, decision, notes, created_at")
        .eq("provider_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);

  const firstError = [
    detailsResult.error,
    servicesResult.error,
    availabilityResult.error,
    photosResult.error,
    credentialsResult.error,
    reviewsResult.error,
  ].find(Boolean);

  if (firstError) {
    if (migrationMissing(firstError.code)) {
      redirect("/setup?reason=provider-onboarding");
    }
    throw new Error("Unable to load the provider workspace.");
  }

  const details = mapDetails(detailsResult.data as DetailsRow);
  const services = (servicesResult.data as ServiceRow[]).map(mapService);
  const availability = mergeAvailability(
    availabilityResult.data as AvailabilityRow[],
  );
  const photos = (photosResult.data as PhotoRow[]).map((row) =>
    mapPhoto(row, publicPhotoUrl(supabase, row.storage_path)),
  );
  const credentials = (credentialsResult.data as CredentialRow[]).map((row) =>
    mapCredential(row),
  );
  const reviewEvents = (reviewsResult.data as ReviewRow[]).map(mapReview);
  const completion = calculateProviderCompletion({
    providerStatus: profile.providerStatus,
    details,
    services,
    availability,
    photos,
    credentials,
  });

  return {
    profile,
    details,
    services,
    availability,
    photos,
    credentials,
    reviewEvents,
    completion,
  };
}

function groupByProvider<T extends { provider_id: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    grouped.set(row.provider_id, [
      ...(grouped.get(row.provider_id) ?? []),
      row,
    ]);
  });
  return grouped;
}

export async function getAdminProviderApplications(): Promise<{
  admin: Awaited<ReturnType<typeof requireRole>>;
  applications: AdminProviderApplication[];
  serviceReviewAvailable: boolean;
}> {
  const admin = await requireRole("admin");
  const supabase = await createClient();
  const profilesResult = await supabase
    .from("profiles")
    .select("id, email, full_name, provider_status, created_at")
    .eq("role", "provider")
    .order("created_at", { ascending: false });

  if (profilesResult.error) {
    if (migrationMissing(profilesResult.error.code)) {
      redirect("/setup?reason=provider-onboarding");
    }
    throw new Error("Unable to load provider accounts.");
  }

  const profiles = profilesResult.data as AdminProfileRow[];
  if (profiles.length === 0) {
    return { admin, applications: [], serviceReviewAvailable: true };
  }

  const providerIds = profiles.map((profile) => profile.id);
  const [detailsResult, servicesResult, availabilityResult, photosResult, credentialsResult, reviewsResult, adminReviewersResult] =
    await Promise.all([
      supabase
        .from("provider_details")
        .select(
          "provider_id, business_name, headline, bio, years_experience, service_area, travel_radius_miles, submitted_at, reviewed_at, updated_at",
        )
        .in("provider_id", providerIds),
      supabase
        .from("provider_services")
        .select(
          "id, provider_id, name, description, pricing_type, price_cents, is_active, updated_at",
        )
        .in("provider_id", providerIds),
      supabase
        .from("provider_availability")
        .select(
          "provider_id, weekday, is_available, start_time, end_time",
        )
        .in("provider_id", providerIds),
      supabase
        .from("provider_photos")
        .select("id, provider_id, storage_path, caption, sort_order")
        .in("provider_id", providerIds),
      supabase
        .from("provider_credentials")
        .select(
          "id, provider_id, credential_type, title, issuer, credential_number, expires_on, document_path, review_status, review_notes, reviewed_at, reviewed_by",
        )
        .in("provider_id", providerIds),
      supabase
        .from("provider_review_events")
        .select("id, provider_id, decision, notes, created_at")
        .in("provider_id", providerIds)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id").eq("role", "admin"),
    ]);

  const firstError = [
    detailsResult.error,
    servicesResult.error,
    availabilityResult.error,
    photosResult.error,
    credentialsResult.error,
    reviewsResult.error,
    adminReviewersResult.error,
  ].find(Boolean);
  if (firstError) {
    if (migrationMissing(firstError.code)) {
      redirect("/setup?reason=provider-onboarding");
    }
    throw new Error("Unable to load provider applications.");
  }

  const serviceRows = servicesResult.data as AdminServiceRow[];
  const serviceIds = serviceRows.map((service) => service.id);
  const serviceReviewQueries = [];
  // Keep each PostgREST URL within normal proxy limits on larger review queues.
  for (let offset = 0; offset < serviceIds.length; offset += 100) {
    serviceReviewQueries.push(supabase.from("provider_service_credential_reviews")
      .select("service_id, license_required, license_credential_ids, insurance_credential_ids, reviewed_at, reviewed_by")
      .in("service_id", serviceIds.slice(offset, offset + 100)));
  }
  const serviceReviewResults = await Promise.all(serviceReviewQueries);
  const serviceReviewAvailable = serviceReviewResults.every((result) => !result.error);
  const serviceReviewById = new Map<string, ServiceCredentialReviewRow>();
  if (serviceReviewAvailable) {
    for (const result of serviceReviewResults) {
      for (const row of (result.data ?? []) as ServiceCredentialReviewRow[]) {
        serviceReviewById.set(row.service_id, row);
      }
    }
  }

  const detailsByProvider = new Map(
    (detailsResult.data as AdminDetailsRow[]).map((row) => [row.provider_id, row]),
  );
  const servicesByProvider = groupByProvider(serviceRows);
  const availabilityByProvider = groupByProvider(
    availabilityResult.data as AvailabilityRow[],
  );
  const photosByProvider = groupByProvider(photosResult.data as PhotoRow[]);
  const credentialsByProvider = groupByProvider(
    credentialsResult.data as AdminCredentialRow[],
  );
  const reviewsByProvider = groupByProvider(reviewsResult.data as ReviewRow[]);
  const adminReviewerIds = new Set((adminReviewersResult.data ?? []).map((reviewer) => reviewer.id as string));

  const today = new Date().toISOString().slice(0, 10);
  const applications = await Promise.all(
    profiles.map(async (profile): Promise<AdminProviderApplication> => {
      const detailsRow = detailsByProvider.get(profile.id);
      if (!detailsRow) {
        throw new Error("A provider profile is missing onboarding details.");
      }

      const details = { ...mapDetails(detailsRow), updatedAt: detailsRow.updated_at };
      const availability = mergeAvailability(
        availabilityByProvider.get(profile.id) ?? [],
      );
      const photos = (photosByProvider.get(profile.id) ?? []).map((row) =>
        mapPhoto(row, publicPhotoUrl(supabase, row.storage_path)),
      );
      const credentials = await Promise.all(
        (credentialsByProvider.get(profile.id) ?? []).map(async (row) => {
          const { data } = await supabase.storage
            .from("provider-credentials")
            .createSignedUrl(row.document_path, 600);
          return mapAdminCredential(row, data?.signedUrl ?? null, today, adminReviewerIds);
        }),
      );
      const eligibleCredentials = new Map(credentials
        .filter((credential) => credential.eligibleForServiceReview)
        .map((credential) => [credential.id, credential.credentialType]));
      const services = (servicesByProvider.get(profile.id) ?? []).map((row) =>
        mapAdminService(row, serviceReviewById.get(row.id), eligibleCredentials));
      const reviewEvents = (reviewsByProvider.get(profile.id) ?? []).map(
        mapReview,
      );
      const completion = calculateProviderCompletion({
        providerStatus: profile.provider_status,
        details,
        services,
        availability,
        photos,
        credentials,
      });

      return {
        profile: {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          providerStatus: profile.provider_status,
          createdAt: profile.created_at,
        },
        details,
        services,
        availability,
        photos,
        credentials,
        reviewEvents,
        completion,
      };
    }),
  );

  applications.sort((a, b) => {
    if (Boolean(a.details.submittedAt) !== Boolean(b.details.submittedAt)) {
      return a.details.submittedAt ? -1 : 1;
    }
    return b.profile.createdAt.localeCompare(a.profile.createdAt);
  });

  return { admin, applications, serviceReviewAvailable };
}

export async function requireActionRole(role: "provider" | "admin") {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    throw new Error("You must be signed in to continue.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (error || data?.role !== role) {
    throw new Error("You do not have permission to perform this action.");
  }

  return { supabase, userId };
}
