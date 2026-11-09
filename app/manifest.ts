import type { MetadataRoute } from "next";

// Manifest của NIKKE (cài lên màn hình chính). Brown Dust 2 có manifest riêng ở /bd2/manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NIKKE Viewer",
    short_name: "NIKKE",
    description: "Showcase nhân vật NIKKE: gallery, viewer Spine tương tác, đổi skin và animation.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#06080c",
    theme_color: "#06080c",
    icons: [
      { src: "/icons/nikke-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/nikke-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/nikke-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
