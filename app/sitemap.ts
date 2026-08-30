import type { MetadataRoute } from "next";

const SITE_URL = "https://www.iburo127.ru";

const INDEXABLE_ROUTES = [
  "/",
  "/about",
  "/praktikum",
  "/reviews",
  "/faq",
  "/contacts",
  "/calculator",
  "/bankruptcy-check",
  "/articles",
  "/offer",
  "/privacy",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_ROUTES.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
  }));
}
