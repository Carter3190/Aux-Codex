/** Keep sign-in return URLs inside authenticated dashboard routes. */
export function safeDashboardReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/")) return null;
  if (value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
    const url = new URL(value, "https://auxilium.invalid");
    if (url.origin !== "https://auxilium.invalid" ||
        (url.pathname !== "/dashboard" && !url.pathname.startsWith("/dashboard/"))) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

const providerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Booking intent is a public provider ID, never an arbitrary redirect URL. */
export function providerBookingReturnPath(providerId: unknown): string | null {
  return typeof providerId === "string" && providerIdPattern.test(providerId)
    ? `/dashboard/customer/request/${providerId.toLowerCase()}`
    : null;
}

export function bookingProviderIdFromReturnPath(value: unknown): string | null {
  const match = typeof value === "string"
    ? /^\/dashboard\/customer\/request\/([^/?#]+)$/.exec(value)
    : null;
  return match && providerBookingReturnPath(match[1]) ? match[1].toLowerCase() : null;
}
