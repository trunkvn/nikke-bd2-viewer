import type { MetadataRoute } from "next";

// Dự án fan chứa asset game (bản quyền thuộc Shift Up, Neowiz / Neon Eyes): không để công cụ tìm kiếm thu thập.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
