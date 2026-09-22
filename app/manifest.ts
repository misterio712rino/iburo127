import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "iБюро — личный кабинет",
    short_name: "iБюро",
    description: "Личный кабинет iБюро",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#102340",
    theme_color: "#102340",
    icons: [
      { src: "/pwa-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
