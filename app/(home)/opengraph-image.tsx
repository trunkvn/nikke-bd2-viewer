import { ImageResponse } from "next/og";

export const alt = "Interactive Anime";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Ảnh chia sẻ: chỉ dùng dấu hiệu tự vẽ (không dùng ảnh nhân vật hay logo gốc, vì asset chỉ để dùng local).
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 96px",
          background: "radial-gradient(60% 80% at 10% 0%, rgba(245,217,10,0.2), transparent 70%), radial-gradient(60% 80% at 90% 0%, rgba(111,111,232,0.32), transparent 70%), #0a0b10",
          color: "#eceef4",
        }}
      >
        <svg width="220" height="220" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f5d90a" />
              <stop offset="1" stopColor="#6f6fe8" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="15" fill="url(#g)" />
          <path fill="#0a0b10" d="M32 8C34 24 40 30 56 32 40 34 34 40 32 56 30 40 24 34 8 32 24 30 30 24 32 8Z" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>Interactive Anime</div>
          <div style={{ fontSize: 38, color: "#98a0b4" }}>NIKKE · Brown Dust 2</div>
          <div style={{ fontSize: 28, color: "rgba(236,238,244,0.55)", marginTop: 10 }}>Live2D character viewer</div>
        </div>
      </div>
    ),
    size,
  );
}
