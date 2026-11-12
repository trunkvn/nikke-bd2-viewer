"use client";

import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, readTheme, subscribeTheme, syncThemeColor, type ThemeMode } from "@/lib/themeMode";

const serverTheme = (): ThemeMode => "dark";

/** Nút đổi sáng/tối (mặt trời/mặt trăng). Dùng được ở header của cả bốn trang: chỉ dùng màu hiện tại của chữ nên tự ăn theo trang. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  // Script trong <head> đã đặt data-theme từ trước; ở đây chỉ chỉnh lại màu thanh địa chỉ cho khớp trang.
  useEffect(() => syncThemeColor(), []);

  const next: ThemeMode = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={next === "light" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      title={next === "light" ? "Giao diện sáng" : "Giao diện tối"}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-foreground/60 outline-none transition hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      {theme === "light" ? (
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
