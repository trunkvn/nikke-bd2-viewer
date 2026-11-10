import type { MetadataRoute } from "next";

// manifest.ts chỉ có ở gốc app (dành cho trang chủ), nên manifest của NIKKE là route handler riêng (layout trỏ tới đây qua metadata.manifest).
const manifest: MetadataRoute.Manifest = {
  name: "NIKKE Viewer",
  short_name: "NIKKE",
  description: "Showcase nhân vật NIKKE: gallery, viewer Spine tương tác, đổi skin và animation.",
  start_url: "/nikke",
  scope: "/nikke",
  display: "standalone",
  background_color: "#06080c",
  theme_color: "#06080c",
  icons: [
    { src: "/icons/nikke-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/nikke-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/nikke-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
