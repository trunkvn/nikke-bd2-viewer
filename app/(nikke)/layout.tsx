import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist_Mono, Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { NO_INDEX, SITE_URL } from "@/lib/site";
import "./globals.css";

// Chakra Petch: font góc cạnh kiểu sci-fi cho tiêu đề/nhãn, có hỗ trợ tiếng Việt.
const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "Showcase nhân vật NIKKE: gallery, viewer Spine tương tác, đổi skin và animation.";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: "NIKKE Viewer — Interactive Character Gallery", template: "%s — NIKKE Viewer" },
  description: DESCRIPTION,
  applicationName: "NIKKE Viewer",
  robots: NO_INDEX,
  openGraph: { type: "website", siteName: "NIKKE Viewer", locale: "vi_VN", title: "NIKKE Viewer", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "NIKKE Viewer", description: DESCRIPTION },
};

// Thanh địa chỉ trên điện thoại ăn theo màu nền; trang luôn tối nên báo cho trình duyệt (form, thanh cuộn) dùng giao diện tối.
export const viewport: Viewport = { themeColor: "#06080c", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${chakra.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        {/* <footer className="border-t border-white/10 px-4 py-6 text-center font-mono text-[11px] tracking-wide text-white/35">
          FAN PROJECT · không liên kết với Shift Up / Level Infinite · NIKKE và mọi tài sản liên quan thuộc về chủ sở hữu
        </footer> */}
      </body>
    </html>
  );
}
