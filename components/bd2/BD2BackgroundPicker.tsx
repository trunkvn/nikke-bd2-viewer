"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BD2_BGS, BD2_DEFAULT_BG, bd2BgOf, bd2BgSetting } from "@/lib/bd2";
import { ToolButton } from "../ViewerStage";

/** Nút "Nền" ở thanh công cụ: bấm để mở bảng các nền dựng sẵn. */
export function BD2BackgroundPicker() {
  const current = useSyncExternalStore(bd2BgSetting.subscribe, bd2BgSetting.get, () => BD2_DEFAULT_BG);
  const active = bd2BgOf(current).id;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <ToolButton label="Đổi nền (phím B)" onClick={() => setOpen((v) => !v)} pressed={open}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m21 16-5-5-8 9" />
        </svg>
      </ToolButton>

      {open && (
        <div role="dialog" aria-label="Chọn nền viewer" className="bd2-glass absolute right-full top-1/2 mr-3 w-[236px] -translate-y-1/2 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Nền</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Nền dựng sẵn">
            {BD2_BGS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                role="radio"
                aria-checked={bg.id === active}
                onClick={() => bd2BgSetting.set(bg.id)}
                className={`rounded-xl border-2 p-1 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent ${
                  bg.id === active ? "border-accent bg-white/10" : "border-transparent hover:bg-white/10"
                }`}
              >
                <span className="block h-11 rounded-lg border border-line" style={{ background: bg.background }} />
                <span className="mt-1 block px-0.5 text-[12px] font-semibold">{bg.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
