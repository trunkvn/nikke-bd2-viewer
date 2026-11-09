import { ImageResponse } from "next/og";

export const alt = "Brown Dust 2 — Character Gallery";
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
          background: "radial-gradient(60% 80% at 85% 0%, rgba(111,111,232,0.4), transparent 70%), #111218",
          color: "#ececf2",
        }}
      >
        <svg width="220" height="220" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="15" fill="#6f6fe8" />
          <path
            fill="#ffffff"
            fillRule="evenodd"
            d="M20 16h15.5c6.2 0 9.8 3 9.8 8 0 3.4-1.8 5.8-4.8 7 4 1 6.3 3.9 6.3 8 0 6-4.3 9-11 9H20zM27.5 22v6h6.2c2.4 0 3.8-1 3.8-3s-1.4-3-3.8-3zM27.5 34v8h7c3 0 4.5-1.5 4.5-4s-1.5-4-4.5-4z"
          />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>Brown Dust 2</div>
          <div style={{ fontSize: 40, color: "#9d9df5" }}>Character Gallery</div>
          <div style={{ fontSize: 30, color: "rgba(236,236,242,0.6)", marginTop: 12 }}>Spine L2D · costumes · Ultimate · Fated Guest</div>
        </div>
      </div>
    ),
    size,
  );
}
