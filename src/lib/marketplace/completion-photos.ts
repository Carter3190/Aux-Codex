import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COMPLETION_PHOTO_BUCKET,
  MAX_COMPLETION_PHOTOS,
  MAX_COMPLETION_PHOTO_BYTES,
  detectCompletionPhotoType,
  validCompletionPhotoPath,
} from "./completion-photo-values";

export type BookingCompletionPhoto = {
  id: string;
  bookingId: string;
  url: string;
  contentType: string;
  byteSize: number;
  position: number;
};

type PhotoRow = {
  id: string;
  booking_id: string;
  storage_path: string;
  content_type: string;
  byte_size: number;
  position: number;
};

function safeCompletionError(message?: string) {
  const expected = ["Only provider", "Only accepted", "Booking request not found", "future booking", "agreed final price", "existing checkout", "fully refunded", "Completion photos cannot", "Choose up to five", "completion photo"];
  return message && expected.some((part) => message.toLowerCase().includes(part.toLowerCase()))
    ? message
    : "The visit could not be completed. Please reload and try again.";
}

export async function completeBookingWithPhotos(supabase: SupabaseClient, bookingId: string, paths: unknown[]): Promise<boolean> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const providerId = claimsData?.claims?.sub;
  if (claimsError || typeof providerId !== "string") throw new Error("Sign in to your provider account to complete this visit.");
  if (!Array.isArray(paths) || paths.length > MAX_COMPLETION_PHOTOS || new Set(paths).size !== paths.length
    || !paths.every((path) => validCompletionPhotoPath(path, providerId, bookingId))) {
    throw new Error("Choose up to five completion photos that belong to this booking.");
  }
  const photoPaths = paths as string[];
  const { data: booking, error: bookingError } = await supabase.from("booking_requests")
    .select("provider_id,status").eq("id", bookingId).eq("provider_id", providerId).maybeSingle();
  if (bookingError || !booking) throw new Error("Booking request not found.");
  if (booking.status !== "accepted" && booking.status !== "completed") throw new Error("Only accepted bookings can be marked complete.");

  // A lost browser response can repeat the same completion. The database permits
  // that exact retry but rejects additions/replacements after completion.
  if (booking.status === "accepted" && photoPaths.length) {
    const admin = createAdminClient();
    const folder = `${providerId}/${bookingId}`;
    for (const path of photoPaths) {
      const filename = path.slice(folder.length + 1);
      const { data: objects, error: listError } = await supabase.storage.from(COMPLETION_PHOTO_BUCKET)
        .list(folder, { search: filename, limit: 10 });
      const object = objects?.find((item) => item.name === filename && item.id);
      if (listError || !object || !object.updated_at) throw new Error("The completion photo upload could not be verified. Upload it again.");
      const declaredSize = Number(object.metadata?.size);
      if (!Number.isFinite(declaredSize) || declaredSize < 1 || declaredSize > MAX_COMPLETION_PHOTO_BYTES) {
        throw new Error("Each completion photo must be 5 MB or smaller.");
      }
      // Download with the participant's authenticated client, not the service
      // key: this preserves Storage's owner/accepted-booking access boundary.
      const { data: image, error: downloadError } = await supabase.storage.from(COMPLETION_PHOTO_BUCKET).download(path);
      if (downloadError || !image || image.size !== declaredSize || image.size > MAX_COMPLETION_PHOTO_BYTES) {
        throw new Error("The completion photo upload could not be verified. Upload it again.");
      }
      const contentType = detectCompletionPhotoType(new Uint8Array(await image.arrayBuffer()));
      if (!contentType || contentType !== object.metadata?.mimetype || contentType !== image.type
        || (contentType === "image/jpeg" && !/\.jpe?g$/.test(filename))
        || (contentType === "image/png" && !filename.endsWith(".png"))
        || (contentType === "image/webp" && !filename.endsWith(".webp"))) {
        throw new Error("Choose a valid JPG, PNG, or WebP completion photo.");
      }
      const { error: verificationError } = await admin.rpc("record_booking_completion_photo_verification", {
        requested_booking_id: bookingId,
        requested_provider_id: providerId,
        requested_storage_path: path,
        requested_object_id: object.id,
        requested_object_updated_at: object.updated_at,
        verified_content_type: contentType,
        verified_byte_size: image.size,
      });
      if (verificationError) throw new Error("The completion photo upload changed while it was being checked. Please try again.");
    }
  }
  const { data: completedNow, error } = await supabase.rpc("complete_booking_with_photos", {
    requested_booking_id: bookingId,
    requested_photo_paths: photoPaths,
  });
  if (error) throw new Error(safeCompletionError(error.message));
  return completedNow === true;
}

export async function getBookingCompletionPhotos(bookingId: string): Promise<{ photos: BookingCompletionPhoto[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("booking_completion_photos")
      .select("id,booking_id,storage_path,content_type,byte_size,position")
      .eq("booking_id", bookingId).order("position", { ascending: true });
    if (error) return { photos: [], error: "Completion photos are temporarily unavailable. Please reload to try again." };
    const rows = (data ?? []) as PhotoRow[];
    if (!rows.length) return { photos: [], error: null };
    const { data: signed, error: signError } = await supabase.storage.from(COMPLETION_PHOTO_BUCKET)
      .createSignedUrls(rows.map((photo) => photo.storage_path), 15 * 60);
    if (signError || !signed) return { photos: [], error: "Completion photos are temporarily unavailable. Please reload to try again." };
    const photos = rows.flatMap((row, index) => {
      const result = signed[index];
      return result?.signedUrl && !result.error ? [{ id: row.id, bookingId: row.booking_id, url: result.signedUrl, contentType: row.content_type, byteSize: row.byte_size, position: row.position }] : [];
    });
    return { photos, error: photos.length === rows.length ? null : "Some completion photos could not be opened. Reload to try again." };
  } catch {
    return { photos: [], error: "Completion photos are temporarily unavailable. Please reload to try again." };
  }
}
