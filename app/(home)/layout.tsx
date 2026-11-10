import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Chakra_Petch, Plus_Jakarta_Sans } from "next/font/google";
import { GameTabs } from "@/components/GameTabs";
import { NO_INDEX, SITE_URL } from "@/lib/site";
import "./home.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});
// Chakra Petch: phông góc cạnh của NIKKE, dùng cho tiêu đề (có tiếng Việt).
const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["500", "600", "700"],
});

const DESCRIPTION = "Showcase nhân vật các game anime: viewer Live2D (Spine) tương tác, đổi trang phục, nghe giọng nói. NIKKE và Brown Dust 2.";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: "Interactive Anime", template: "%s — Interactive Anime" },
  description: DESCRIPTION,
  applicationName: "Interactive Anime",
  robots: NO_INDEX,
  openGraph: { type: "website", siteName: "Interactive Anime", locale: "vi_VN", title: "Interactive Anime", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Interactive Anime", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#0a0b10", colorScheme: "dark" };

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${jakarta.variable} ${chakra.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header data-site-header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="group flex items-center gap-2.5 outline-none">
              {/* Dấu hiệu tự vẽ: ô chuyển màu từ vàng (NIKKE) sang chàm (Brown Dust 2) với ngôi sao bốn cánh. */}
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#f5d90a] to-[#6f6fe8] text-[#0a0b10] transition group-hover:rotate-12 group-focus-visible:rotate-12"
              >
                <svg viewBox="0 0 64 64" className="h-5 w-5" fill="currentColor">
                  <path d="M32 8C34 24 40 30 56 32 40 34 34 40 32 56 30 40 24 34 8 32 24 30 30 24 32 8Z" />
                </svg>
              </span>
              <span className="hidden whitespace-nowrap font-display text-[17px] font-bold tracking-wide sm:inline">Interactive Anime</span>
            </Link>
            <div className="ml-auto">
              <GameTabs current="home" variant="home" />
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line px-4 py-6 text-center text-xs leading-relaxed text-muted">
          Dự án fan, không liên kết với Shift Up, Level Infinite hay Neowiz. Nhân vật và hình ảnh thuộc về chủ sở hữu, chỉ dùng cá nhân.
        </footer>
      </body>
    </html>
  );
}
