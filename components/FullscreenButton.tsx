"use client";

import { ToolButton } from "./ViewerStage";

/** Nút vào/thoát toàn màn hình trong thanh công cụ của viewer. */
export function FullscreenButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <ToolButton
      label={active ? "Thoát toàn màn hình (F hoặc Esc)" : "Toàn màn hình (phím F)"}
      onClick={onToggle}
      pressed={active}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {active ? (
          // Thu nhỏ: bốn góc hướng vào trong
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          // Mở rộng: bốn góc hướng ra ngoài
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </ToolButton>
  );
}
