export const COMPLETION_PHOTO_BUCKET = "booking-completion-photos";
export const MAX_COMPLETION_PHOTOS = 5;
export const MAX_COMPLETION_PHOTO_BYTES = 5 * 1024 * 1024;

export type CompletionPhotoType = "image/jpeg" | "image/png" | "image/webp";

export function isCompletionPhotoType(value: string): value is CompletionPhotoType {
  return ["image/jpeg", "image/png", "image/webp"].includes(value);
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function completionPhotoPath(providerId: string, bookingId: string, fileId: string, contentType: string) {
  if (![providerId, bookingId, fileId].every((value) => uuid.test(value)) || !isCompletionPhotoType(contentType)) {
    throw new Error("Choose a JPG, PNG, or WebP completion photo.");
  }
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return `${providerId.toLowerCase()}/${bookingId.toLowerCase()}/${fileId.toLowerCase()}.${extension}`;
}

export function validCompletionPhotoPath(value: unknown, providerId: string, bookingId: string): value is string {
  if (typeof value !== "string") return false;
  const segments = value.split("/");
  if (segments.length !== 3 || segments[0] !== providerId.toLowerCase() || segments[1] !== bookingId.toLowerCase()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/.test(segments[2]);
}

// Check bytes, not a browser-supplied filename or Content-Type. SVG/HTML are
// deliberately unsupported, including when renamed to an accepted extension.
export function detectCompletionPhotoType(bytes: Uint8Array): CompletionPhotoType | null {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    && String.fromCharCode(...bytes.subarray(12, 16)) === "IHDR") return "image/png";
  if (bytes.length >= 20 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
    && ["VP8 ", "VP8L", "VP8X"].includes(String.fromCharCode(...bytes.subarray(12, 16)))) return "image/webp";
  return null;
}
