export const legalVersion = "2026-09-21";

const productionAppUrl = "https://app.theauxillium.com";

export function getPublicAppUrl() {
  const configuredUrl = process.env.APP_URL?.trim();

  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (url.protocol === "https:" || url.hostname === "localhost") {
        return url.origin;
      }
    } catch {
      // Fall through to a safe public default for metadata generation.
    }
  }

  return process.env.NODE_ENV === "production"
    ? productionAppUrl
    : "http://localhost:3000";
}
