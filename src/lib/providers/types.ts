import type { CurrentProfile, ProviderStatus } from "@/lib/auth/profile";

export type { ProviderStatus } from "@/lib/auth/profile";

export type PricingType = "hourly" | "fixed" | "starting_at" | "quote";

export type CredentialType =
  | "license"
  | "insurance"
  | "certification"
  | "identity"
  | "background_check"
  | "other";

export type CredentialReviewStatus = "pending" | "approved" | "rejected";

export type ProviderDetails = {
  providerId: string;
  businessName: string;
  headline: string;
  bio: string;
  yearsExperience: number | null;
  serviceArea: string;
  travelRadiusMiles: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

export type ProviderService = {
  id: string;
  name: string;
  description: string;
  pricingType: PricingType;
  priceCents: number | null;
  isActive: boolean;
};

export type ProviderAvailability = {
  weekday: number;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
};

export type ProviderPhoto = {
  id: string;
  storagePath: string;
  publicUrl: string;
  caption: string;
  sortOrder: number;
};

export type ProviderCredential = {
  id: string;
  credentialType: CredentialType;
  title: string;
  issuer: string;
  credentialNumber: string;
  expiresOn: string | null;
  documentPath: string;
  documentUrl?: string | null;
  reviewStatus: CredentialReviewStatus;
  reviewNotes: string;
};

export type ProviderReviewEvent = {
  id: string;
  decision: "approved" | "rejected";
  notes: string;
  createdAt: string;
};

export type ProviderCompletion = {
  introduction: boolean;
  services: boolean;
  photos: boolean;
  credentials: boolean;
  availability: boolean;
  completedCount: number;
  totalCount: number;
  percentage: number;
  isComplete: boolean;
};

export type ProviderWorkspace = {
  profile: CurrentProfile;
  details: ProviderDetails;
  services: ProviderService[];
  availability: ProviderAvailability[];
  photos: ProviderPhoto[];
  credentials: ProviderCredential[];
  reviewEvents: ProviderReviewEvent[];
  completion: ProviderCompletion;
};

export type AdminProviderApplication = Omit<ProviderWorkspace, "profile"> & {
  profile: {
    id: string;
    email: string;
    fullName: string;
    providerStatus: ProviderStatus;
    createdAt: string;
  };
};

export type ProviderFieldErrors = Record<string, string[] | undefined>;

export type ProviderActionState = {
  status?: "success" | "error";
  message?: string;
  fieldErrors?: ProviderFieldErrors;
};

export const initialProviderActionState: ProviderActionState = {};
