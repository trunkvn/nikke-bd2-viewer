import type { Metadata, ResolvingMetadata } from "next";

/**
 * Địa chỉ gốc của site, dùng làm `metadataBase` để các đường dẫn ảnh chia sẻ (Open Graph) thành địa chỉ đầy đủ.
 * Đặt `NEXT_PUBLIC_SITE_URL` (ví dụ https://anime.example.com) khi triển khai; trên Vercel tự lấy tên miền production; còn lại là localhost.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
);

/** Site chứa asset game của Neowiz / Shift Up chỉ dùng local: không cho công cụ tìm kiếm lập chỉ mục. */
export const NO_INDEX = { index: false, follow: false } as const;

/**
 * Metadata chia sẻ (Open Graph + Twitter) cho một trang con. Đặt `openGraph` ở trang sẽ thay hẳn phần của layout, kể cả ảnh chia sẻ
 * (file opengraph-image), nên lấy lại ảnh và mô tả từ metadata cha.
 */
export async function shareMetadata(parent: ResolvingMetadata, siteName: string, title: string, description?: string): Promise<Pick<Metadata, "openGraph" | "twitter">> {
  const up = await parent;
  const desc = description || up.description || undefined;
  return {
    openGraph: { type: "website", siteName, locale: "vi_VN", title, description: desc, images: up.openGraph?.images },
    twitter: { card: "summary_large_image", title, description: desc, images: up.twitter?.images ?? up.openGraph?.images },
  };
}
