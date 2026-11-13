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
