import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private / transactional / app routes — no SEO value, keep out of the index.
        disallow: ["/admin", "/api/", "/my-designs", "/my-orders", "/success", "/track", "/sign-in", "/sign-up"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
