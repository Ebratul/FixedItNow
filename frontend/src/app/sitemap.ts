import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const ROUTES = [
  "/",
  "/services",
  "/workers",
  "/how-it-works",
  "/become-a-worker",
  "/about",
  "/help",
  "/contact",
];

/** Empty until NEXT_PUBLIC_SITE_URL is set; we do not guess the domain. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URL) return [];
  return ROUTES.map((route) => ({ url: `${SITE_URL}${route}` }));
}
