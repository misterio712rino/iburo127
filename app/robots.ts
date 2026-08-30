import type { MetadataRoute } from "next";

const SITE_URL = "https://www.iburo127.ru";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/portal/", "/app/", "/_iburo/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
