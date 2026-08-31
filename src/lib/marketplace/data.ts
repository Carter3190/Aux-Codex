import "server-only";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  BookingRequest,
  BookingStatus,
  MarketplaceProvider,
  MarketplaceProviderCard,
  MarketplaceService,
  PublicAvailability,
  PublicCredential,
  PublicPhoto,
} from "./types";
import type { PricingType } from "@/lib/providers/types";

type ProviderSearchRow = {
  provider_id: string;
  display_name: string;
  headline: string;
  bio_preview: string;
  service_area: string;
  years_experience: number | null;
  travel_radius_miles: number | null;
  primary_photo_path: string | null;
  services: MarketplaceService[] | null;
};

type ProviderDetailPayload = {
  providerId: string;
  displayName: string;
  headline: string;
  bio: string;
  serviceArea: string;
  yearsExperience: number | null;
  travelRadiusMiles: number | null;
  services: MarketplaceService[];
  availability: PublicAvailability[];
  photos: Array<{ id: string; storagePath: string; caption: string }>;
  credentials: PublicCredential[];
};

type BookingRow = {
  id: string;
  customer_id: string;
  provider_id: string;
  customer_name: string;
  provider_name: string;
  service_name: string;
  pricing_type: PricingType;
  price_cents: number | null;
  requested_date: string;
  requested_start_time: string;
  service_location: string;
  customer_notes: string;
  status: BookingStatus;
  provider_response: string;
  responded_at: string | null;
  created_at: string;
};

function marketplaceMigrationMissing(code?: string) {
  return code === "42P01" || code === "42703" || code === "PGRST202";
}

function publicPhotoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
) {
  return supabase.storage.from("provider-photos").getPublicUrl(path).data
    .publicUrl;
}

function mapBooking(row: BookingRow): BookingRequest {
  return {
    id: row.id,
    customerId: row.customer_id,
    providerId: row.provider_id,
    customerName: row.customer_name,
    providerName: row.provider_name,
    serviceName: row.service_name,
    pricingType: row.pricing_type,
    priceCents: row.price_cents,
    requestedDate: row.requested_date,
    requestedStartTime: row.requested_start_time.slice(0, 5),
    serviceLocation: row.service_location,
    customerNotes: row.customer_notes,
    status: row.status,
    providerResponse: row.provider_response,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
  };
}

export async function searchApprovedProviders(input: {
  search?: string;
  area?: string;
}): Promise<MarketplaceProviderCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_approved_providers", {
    search_term: input.search?.trim().slice(0, 100) ?? "",
    area_term: input.area?.trim().slice(0, 100) ?? "",
  });

  if (error) {
    if (marketplaceMigrationMissing(error.code)) {
      redirect("/setup?reason=customer-marketplace");
    }
    throw new Error("Unable to load approved providers.");
  }

  return ((data ?? []) as ProviderSearchRow[]).map((row) => ({
    providerId: row.provider_id,
    displayName: row.display_name,
    headline: row.headline,
    bioPreview: row.bio_preview,
    serviceArea: row.service_area,
    yearsExperience: row.years_experience,
    travelRadiusMiles: row.travel_radius_miles,
    primaryPhotoUrl: row.primary_photo_path
      ? publicPhotoUrl(supabase, row.primary_photo_path)
      : null,
    services: row.services ?? [],
  }));
}

export async function getApprovedProvider(
  providerId: string,
): Promise<MarketplaceProvider | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_approved_provider", {
    requested_provider_id: providerId,
  });

  if (error) {
    if (marketplaceMigrationMissing(error.code)) {
      redirect("/setup?reason=customer-marketplace");
    }
    throw new Error("Unable to load this provider.");
  }

  if (!data) return null;
  const provider = data as ProviderDetailPayload;
  return {
    providerId: provider.providerId,
    displayName: provider.displayName,
    headline: provider.headline,
    bio: provider.bio,
    serviceArea: provider.serviceArea,
    yearsExperience: provider.yearsExperience,
    travelRadiusMiles: provider.travelRadiusMiles,
    services: provider.services ?? [],
    availability: provider.availability ?? [],
    photos: (provider.photos ?? []).map(
      (photo): PublicPhoto => ({
        id: photo.id,
        publicUrl: publicPhotoUrl(supabase, photo.storagePath),
        caption: photo.caption,
      }),
    ),
    credentials: provider.credentials ?? [],
  };
}

const bookingColumns =
  "id, customer_id, provider_id, customer_name, provider_name, service_name, pricing_type, price_cents, requested_date, requested_start_time, service_location, customer_notes, status, provider_response, responded_at, created_at";

export async function getCustomerBookings(): Promise<{
  customer: Awaited<ReturnType<typeof requireRole>>;
  bookings: BookingRequest[];
}> {
  const customer = await requireRole("customer");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_requests")
    .select(bookingColumns)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (marketplaceMigrationMissing(error.code)) {
      redirect("/setup?reason=customer-marketplace");
    }
    throw new Error("Unable to load your booking requests.");
  }

  return { customer, bookings: (data as BookingRow[]).map(mapBooking) };
}

export async function getProviderBookings(): Promise<BookingRequest[]> {
  const provider = await requireRole("provider");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_requests")
    .select(bookingColumns)
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (marketplaceMigrationMissing(error.code)) {
      redirect("/setup?reason=customer-marketplace");
    }
    throw new Error("Unable to load booking requests.");
  }

  return (data as BookingRow[]).map(mapBooking);
}

export async function requireMarketplaceActionRole(
  role: "customer" | "provider",
) {
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
    throw new Error(`Only ${role} accounts can perform this action.`);
  }

  return { supabase, userId };
}
