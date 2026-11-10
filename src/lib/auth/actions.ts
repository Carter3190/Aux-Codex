"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getRequiredLegalAgreements } from "@/lib/legal/agreements";
import type { AuthFormState, ConfirmationFormState } from "./types";

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use no more than 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(100, "Use no more than 100 characters."),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: passwordSchema,
  role: z.enum(["customer", "provider"], {
    error: "Choose how you plan to use Auxilium.",
  }),
  terms: z.literal("accepted", {
    error: "Review and accept the marketplace agreements.",
  }),
});

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

const confirmationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
});

function configurationError(): AuthFormState | null {
  if (isSupabaseConfigured()) {
    return null;
  }

  return {
    message:
      "Auxilium authentication is not connected yet. Add your Supabase project details first.",
  };
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }

  if (normalized.includes("rate limit")) {
    return "Too many attempts. Wait a moment and try again.";
  }

  if (normalized.includes("already registered")) {
    return "An account may already use this email. Try signing in instead.";
  }

  return "We could not complete that request. Please try again.";
}

export async function signUp(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const missingConfiguration = configurationError();
  if (missingConfiguration) {
    return missingConfiguration;
  }

  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    terms: formData.get("terms"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const acceptedAgreements = getRequiredLegalAgreements(parsed.data.role);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        requested_role: parsed.data.role,
        accepted_legal_versions: Object.fromEntries(
          acceptedAgreements.map((agreement) => [
            agreement.key,
            agreement.version,
          ]),
        ),
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    return { message: friendlyAuthError(error.message) };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  redirect("/auth/check-email");
}

export async function signIn(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const missingConfiguration = configurationError();
  if (missingConfiguration) {
    return missingConfiguration;
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { message: friendlyAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/login");
}

export async function resendConfirmation(
  _previousState: ConfirmationFormState,
  formData: FormData,
): Promise<ConfirmationFormState> {
  const parsed = confirmationSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!isSupabaseConfigured()) {
    return { message: "Email confirmation is temporarily unavailable. Please try again later." };
  }

  try {
    const supabase = await createClient();
    // Use the same configured confirmation template and callback as signup.
    // Supabase enforces its existing delivery and authentication rate limits.
    await supabase.auth.resend({ type: "signup", email: parsed.data.email });
  } catch {
    // Keep account existence and account-specific delivery results private.
  }

  return {
    message: "Check your inbox and spam folder for the newest confirmation email. If your account is already confirmed, you can sign in. Wait a minute before requesting another link.",
    retryAfterSeconds: 60,
  };
}
