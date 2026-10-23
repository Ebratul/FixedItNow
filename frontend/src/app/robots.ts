import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    // Only advertise a sitemap once the production origin is known.
    ...(SITE_URL && { sitemap: `${SITE_URL}/sitemap.xml` }),
  };
}
