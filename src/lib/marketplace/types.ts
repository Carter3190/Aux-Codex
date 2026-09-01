import type { CurrentProfile } from "@/lib/auth/profile";
import type { PricingType } from "@/lib/providers/types";

export type MarketplaceService = {
  id: string;
  name: string;
  description?: string;
  pricingType: PricingType;
  priceCents: number | null;
};

export type MarketplaceProviderCard = {
  providerId: string;
  displayName: string;
  headline: string;
  bioPreview: string;
  serviceArea: string;
  yearsExperience: number | null;
  travelRadiusMiles: number | null;
  primaryPhotoUrl: string | null;
  services: MarketplaceService[];
};

export type PublicAvailability = {
  weekday: number;
  startTime: string;
  endTime: string;
};

export type PublicPhoto = {
  id: string;
  publicUrl: string;
  caption: string;
};

export type PublicCredential = {
  id: string;
  type: string;
  title: string;
  issuer: string;
  expiresOn: string | null;
};

export type MarketplaceProvider = {
  providerId: string;
  displayName: string;
  headline: string;
  bio: string;
  serviceArea: string;
  yearsExperience: number | null;
  travelRadiusMiles: number | null;
  services: MarketplaceService[];
  availability: PublicAvailability[];
  photos: PublicPhoto[];
  credentials: PublicCredential[];
};

export type BookingStatus = "pending" | "accepted" | "declined" | "cancelled";

export type BookingRequest = {
  id: string;
  customerId: string;
  providerId: string;
  customerName: string;
  providerName: string;
  serviceName: string;
  pricingType: PricingType;
  priceCents: number | null;
  requestedDate: string;
  requestedStartTime: string;
  serviceLocation: string;
  customerNotes: string;
  status: BookingStatus;
  providerResponse: string;
  respondedAt: string | null;
  createdAt: string;
};

export type BookingMessage = {
  id: string;
  bookingId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type ConversationSummary = {
  booking: BookingRequest;
  counterpartName: string;
  lastMessage: BookingMessage | null;
};

export type BookingConversation = {
  profile: CurrentProfile;
  booking: BookingRequest;
  messages: BookingMessage[];
  perspective: "customer" | "provider";
  counterpartName: string;
  canSend: boolean;
};

export type MarketplaceActionState = {
  status?: "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialMarketplaceActionState: MarketplaceActionState = {};

export type MarketplaceViewer = Pick<CurrentProfile, "id" | "role"> | null;
