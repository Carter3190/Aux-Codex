import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/site";

const publicRoutes = [
  "",
  "/providers",
  "/support",
  "/terms",
  "/privacy",
  "/cancellation-refunds",
  "/provider-agreement",
  "/provider-standards",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getPublicAppUrl();

  return publicRoutes.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified: new Date("2026-09-21T00:00:00.000Z"),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/providers" ? 0.9 : 0.5,
  }));
}
