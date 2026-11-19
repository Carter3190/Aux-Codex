import type { CurrentProfile } from "./profile";

export function accountNavigationState(profile: Pick<CurrentProfile, "fullName" | "role"> | null) {
  const words = profile?.fullName.trim().split(/\s+/).filter(Boolean) ?? [];
  const names = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  const initials = names.map((name) => Array.from(name)[0] ?? "").join("").toUpperCase().slice(0, 2) || "A";

  return {
    account: profile ? { initials, photoUrl: null, href: `/dashboard/${profile.role}` } : null,
    showOfferServices: profile?.role !== "provider",
  };
}

const allowedOrigins = new Set([
  "https://theauxillium.com",
  "https://www.theauxillium.com",
  "https://app.theauxillium.com",
]);

export function accountNavigationHeaders(origin: string | null): Headers | null {
  if (origin !== null && !allowedOrigins.has(origin)) return null;
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Origin, Cookie",
  });
  if (origin !== null) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
  return headers;
}
