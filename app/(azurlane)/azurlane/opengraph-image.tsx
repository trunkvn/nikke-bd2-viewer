import { ImageResponse } from "next/og";

export const alt = "Azur Lane — Live2D Gallery";
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
          background: "radial-gradient(70% 90% at 10% 0%, rgba(56,189,248,0.28), transparent 70%), radial-gradient(60% 80% at 95% 100%, rgba(59,90,200,0.3), transparent 70%), #0a1424",
          color: "#e8f1ff",
        }}
      >
        <svg width="220" height="220" viewBox="0 0 64 64">
          <path fill="#38bdf8" d="M4 4h56v38L32 61 4 42z" />
          <path fill="#04121f" fillRule="evenodd" d="M32 12 46 51h-7l-2.4-7H27.4L25 51h-7zM29.6 38h4.8L32 30z" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: 8, lineHeight: 1 }}>AZUR LANE</div>
          <div style={{ fontSize: 40, color: "#38bdf8" }}>Live2D Gallery</div>
          <div style={{ fontSize: 28, color: "rgba(232,241,255,0.6)", marginTop: 10 }}>Touch · Motions · Live2D</div>
        </div>
      </div>
    ),
    size,
  );
}
