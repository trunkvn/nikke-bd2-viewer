import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import { BD2Header } from "@/components/bd2/BD2Header";
import { NO_INDEX, SITE_URL } from "@/lib/site";
import "./bd2.css";

// Layout gốc riêng của Brown Dust 2: khác hẳn NIKKE về phông, màu và header.
// Plus Jakarta Sans: một họ chữ không chân, hiện đại, có tiếng Việt, dùng cho cả tiêu đề lẫn chữ thân.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const DESCRIPTION = "Showcase nhân vật Brown Dust 2: gallery, viewer Spine tương tác, trang phục và biểu cảm.";

// Cormorant Garamond: chữ có chân nghiêng cho tên nhân vật và tiêu đề (có tiếng Việt).
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: "Brown Dust 2 — Character Gallery", template: "%s — Brown Dust 2" },
  description: DESCRIPTION,
  applicationName: "Brown Dust 2 Gallery",
  manifest: "/bd2/manifest.webmanifest",
  robots: NO_INDEX,
  openGraph: { type: "website", siteName: "Brown Dust 2 Gallery", locale: "vi_VN", title: "Brown Dust 2 — Character Gallery", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Brown Dust 2 — Character Gallery", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#120f2b", colorScheme: "dark" };

export default function BD2Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${jakarta.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <BD2Header />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
