import type { Metadata } from "next";
import { Chakra_Petch, Geist_Mono, Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
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

export const metadata: Metadata = {
  title: "NIKKE Viewer — Interactive Character Gallery",
  description: "Showcase nhân vật NIKKE: gallery, viewer Spine tương tác, đổi skin và animation.",
};

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
