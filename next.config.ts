import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // NIKKE từng ở gốc (/ và /characters/...), nay ở /nikke như Brown Dust 2 ở /bd2. Giữ link cũ còn dùng được (307, không bị trình duyệt nhớ lâu).
    return [{ source: "/characters/:slug", destination: "/nikke/characters/:slug", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
