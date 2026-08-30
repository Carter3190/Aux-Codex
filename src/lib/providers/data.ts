import "server-only";

import { redirect } from "next/navigation";
import { requireRole, type ProviderStatus } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminProviderApplication,
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

function mapReview(row: ReviewRow): ProviderReviewEvent {
  return {
    id: row.id,
    decision: row.decision,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function calculateProviderCompletion(input: {
  details: ProviderDetails;
  services: ProviderService[];
  availability: ProviderAvailability[];
  photos: ProviderPhoto[];
  credentials: ProviderCredential[];
}): ProviderCompletion {
  const checks = {
    introduction:
      input.details.headline.trim().length >= 10 &&
      input.details.bio.trim().length >= 80 &&
      input.details.serviceArea.trim().length >= 2,
    services: input.services.some((service) => service.isActive),
    photos: input.photos.length > 0,
    credentials: input.credentials.length > 0,
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
    return { admin, applications: [] };
  }

  const providerIds = profiles.map((profile) => profile.id);
  const [detailsResult, servicesResult, availabilityResult, photosResult, credentialsResult, reviewsResult] =
    await Promise.all([
      supabase
        .from("provider_details")
        .select(
          "provider_id, business_name, headline, bio, years_experience, service_area, travel_radius_miles, submitted_at, reviewed_at",
        )
        .in("provider_id", providerIds),
      supabase
        .from("provider_services")
        .select(
          "id, provider_id, name, description, pricing_type, price_cents, is_active",
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
          "id, provider_id, credential_type, title, issuer, credential_number, expires_on, document_path, review_status, review_notes",
        )
        .in("provider_id", providerIds),
      supabase
        .from("provider_review_events")
        .select("id, provider_id, decision, notes, created_at")
        .in("provider_id", providerIds)
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
    throw new Error("Unable to load provider applications.");
  }

  const detailsByProvider = new Map(
    (detailsResult.data as DetailsRow[]).map((row) => [row.provider_id, row]),
  );
  const servicesByProvider = groupByProvider(
    servicesResult.data as ServiceRow[],
  );
  const availabilityByProvider = groupByProvider(
    availabilityResult.data as AvailabilityRow[],
  );
  const photosByProvider = groupByProvider(photosResult.data as PhotoRow[]);
  const credentialsByProvider = groupByProvider(
    credentialsResult.data as CredentialRow[],
  );
  const reviewsByProvider = groupByProvider(reviewsResult.data as ReviewRow[]);

  const applications = await Promise.all(
    profiles.map(async (profile): Promise<AdminProviderApplication> => {
      const detailsRow = detailsByProvider.get(profile.id);
      if (!detailsRow) {
        throw new Error("A provider profile is missing onboarding details.");
      }

      const details = mapDetails(detailsRow);
      const services = (servicesByProvider.get(profile.id) ?? []).map(mapService);
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
          return mapCredential(row, data?.signedUrl ?? null);
        }),
      );
      const reviewEvents = (reviewsByProvider.get(profile.id) ?? []).map(
        mapReview,
      );
      const completion = calculateProviderCompletion({
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

  return { admin, applications };
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
