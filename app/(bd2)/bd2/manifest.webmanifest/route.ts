import type { MetadataRoute } from "next";

// manifest.ts chỉ có ở gốc app, nên manifest của Brown Dust 2 là route handler riêng (layout trỏ tới đây qua metadata.manifest).
const manifest: MetadataRoute.Manifest = {
  name: "Brown Dust 2 — Character Gallery",
  short_name: "BD2",
  description: "Showcase nhân vật Brown Dust 2: gallery, viewer Spine tương tác, trang phục và biểu cảm.",
  start_url: "/bd2",
  scope: "/bd2",
  display: "standalone",
  background_color: "#120f2b",
  theme_color: "#120f2b",
  icons: [
    { src: "/icons/bd2-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/bd2-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/bd2-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
