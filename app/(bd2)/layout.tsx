import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BD2Header } from "@/components/bd2/BD2Header";
import "./bd2.css";

// Layout gốc riêng của Brown Dust 2: khác hẳn NIKKE về phông, màu và header.
// Plus Jakarta Sans: một họ chữ không chân, hiện đại, có tiếng Việt, dùng cho cả tiêu đề lẫn chữ thân.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Brown Dust 2 — Character Gallery",
  description: "Showcase nhân vật Brown Dust 2: gallery, viewer Spine tương tác, trang phục và biểu cảm.",
};

export default function BD2Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <BD2Header />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
