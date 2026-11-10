import { ImageResponse } from "next/og";

export const alt = "NIKKE Viewer — Interactive Character Gallery";
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
          background: "radial-gradient(70% 90% at 85% 10%, rgba(245,217,10,0.22), transparent 70%), #06080c",
          color: "#e9edf2",
        }}
      >
        <svg width="220" height="220" viewBox="0 0 64 64">
          <path fill="#f5d90a" d="M12 0h52v52L52 64H0V12z" />
          <path fill="#06080c" fillRule="evenodd" d="M18 48V16h8.5L39 34.5V16h7v32h-8.5L25 29.5V48z" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: 10, lineHeight: 1 }}>NIKKE</div>
          <div style={{ fontSize: 40, letterSpacing: 18, color: "#f5d90a" }}>VIEWER</div>
          <div style={{ fontSize: 30, color: "rgba(233,237,242,0.65)", marginTop: 12 }}>Interactive character gallery · Spine L2D</div>
        </div>
      </div>
    ),
    size,
  );
}
