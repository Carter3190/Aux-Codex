import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getPublicAppUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/providers"],
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard/",
        "/login",
        "/setup",
        "/signup",
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
