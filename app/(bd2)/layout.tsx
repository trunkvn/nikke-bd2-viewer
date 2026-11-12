import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist_Mono, Inter } from "next/font/google";
import { BD2Header } from "@/components/bd2/BD2Header";
import { NO_INDEX, SITE_URL } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/themeMode";
import "./bd2.css";

// Layout gốc riêng của Brown Dust 2 (màu và hình khối khác NIKKE) nhưng dùng cùng bộ phông với NIKKE:
// Chakra Petch cho tiêu đề/nhãn, Inter cho chữ thân, Geist Mono cho nhãn nhỏ. Cả ba có tiếng Việt (trừ Geist Mono chỉ dùng cho chữ Latin).
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

const DESCRIPTION = "Showcase nhân vật Brown Dust 2: gallery, viewer Spine tương tác, trang phục và biểu cảm.";

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

export const viewport: Viewport = { themeColor: "#120f2b", colorScheme: "dark light" };

export default function BD2Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${chakra.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <BD2Header />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
