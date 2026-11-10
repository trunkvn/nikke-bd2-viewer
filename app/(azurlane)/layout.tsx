import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist_Mono, Inter } from "next/font/google";
import { AzurHeader } from "@/components/azurlane/AzurHeader";
import { NO_INDEX, SITE_URL } from "@/lib/site";
import "./azurlane.css";

// Layout gốc riêng của Azur Lane (màu và hình khối riêng) nhưng cùng bộ phông với NIKKE và Brown Dust 2.
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

const DESCRIPTION = "Showcase nhân vật Azur Lane: gallery và viewer Live2D tương tác, chạm vào nhân vật để nghe và xem phản ứng.";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: "Azur Lane — Live2D Gallery", template: "%s — Azur Lane" },
  description: DESCRIPTION,
  applicationName: "Azur Lane Viewer",
  manifest: "/azurlane/manifest.webmanifest",
  robots: NO_INDEX,
  openGraph: { type: "website", siteName: "Azur Lane Viewer", locale: "vi_VN", title: "Azur Lane — Live2D Gallery", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Azur Lane — Live2D Gallery", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#0a1424", colorScheme: "dark" };

export default function AzurLaneLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${chakra.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AzurHeader />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
