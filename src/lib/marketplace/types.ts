import type { CurrentProfile } from "@/lib/auth/profile";
import type { PricingType } from "@/lib/providers/types";
import type { BookingPayment } from "@/lib/payments/types";

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
  averageRating: number | null;
  reviewCount: number;
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

export type VerifiedReview = {
  id: string;
  rating: number;
  body: string;
  reviewerName: string;
  serviceName: string;
  createdAt: string;
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
  averageRating: number | null;
  reviewCount: number;
  reviews: VerifiedReview[];
};

export type BookingStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed";

export type BookingRequest = {
  id: string;
  customerId: string;
  providerId: string;
  customerName: string;
  providerName: string;
  serviceName: string;
  pricingType: PricingType;
  priceCents: number | null;
  agreedPriceCents: number | null;
  priceSetAt: string | null;
  requestedDate: string;
  requestedStartTime: string;
  serviceLocation: string;
  customerNotes: string;
  status: BookingStatus;
  providerResponse: string;
  respondedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  payment: BookingPayment | null;
  review: VerifiedReview | null;
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
