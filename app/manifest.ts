import type { MetadataRoute } from "next";

// Manifest của trang chủ. Mỗi game có manifest riêng (/nikke/manifest.webmanifest, /bd2/manifest.webmanifest) với phạm vi hẹp hơn.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Interactive Anime",
    short_name: "Anime",
    description: "Showcase nhân vật các game anime: viewer Live2D (Spine) tương tác.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0b10",
    theme_color: "#0a0b10",
    icons: [
      { src: "/icons/home-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/home-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/home-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
