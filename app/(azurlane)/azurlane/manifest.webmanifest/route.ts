import type { MetadataRoute } from "next";

// manifest.ts chỉ có ở gốc app (dành cho trang chủ), nên manifest của Azur Lane là route handler riêng (layout trỏ tới đây qua metadata.manifest).
const manifest: MetadataRoute.Manifest = {
  name: "Azur Lane — Live2D Gallery",
  short_name: "Azur Lane",
  description: "Showcase nhân vật Azur Lane: gallery và viewer Live2D tương tác.",
  start_url: "/azurlane",
  scope: "/azurlane",
  display: "standalone",
  background_color: "#0a1424",
  theme_color: "#0a1424",
  icons: [
    { src: "/icons/azurlane-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/azurlane-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/azurlane-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
