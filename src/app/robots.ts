import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
  };
}
