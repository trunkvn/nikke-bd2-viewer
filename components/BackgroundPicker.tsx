"use client";

import { useEffect, useRef, useState } from "react";
import {
  BG_PRESETS,
  bgImageSetting,
  bgSetting,
  bgStyle,
  imageFileToDataUrl,
  useViewerBg,
} from "@/lib/viewerBg";
import { ToolButton } from "./ViewerStage";

/** Nút "Nền" ở thanh công cụ; bấm để mở bảng chọn nền dựng sẵn, màu tuỳ chọn hoặc ảnh của bạn. */
export function BackgroundPicker() {
  const { choice, image } = useViewerBg();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await imageFileToDataUrl(file);
      const saved = bgImageSetting.set(dataUrl);
      bgSetting.set("image");
      setNotice(saved ? null : "Ảnh quá lớn để lưu lâu dài, chỉ dùng trong phiên này.");
    } catch {
      setNotice("Không đọc được ảnh này.");
    }
  };

  const currentColor = choice.kind === "color" ? choice.value : "#1a2233";
  const isPreset = (id: string) => choice.kind === "preset" && choice.id === id;

  return (
    <div ref={wrapRef} className="relative">
      <ToolButton label="Đổi nền (phím B)" onClick={() => setOpen((v) => !v)} pressed={open}>
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
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m21 16-5-5-8 9" />
        </svg>
      </ToolButton>

      {open && (
        <div
          role="dialog"
          aria-label="Chọn nền viewer"
          className="clip-chamfer absolute right-full top-1/2 mr-3 w-[264px] -translate-y-1/2 bg-white/15 p-px"
        >
          <div className="clip-chamfer bg-panel/90 p-3 backdrop-blur-md">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Nền viewer</p>

            <div className="grid grid-cols-4 gap-2">
              {BG_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isPreset(p.id)}
                  aria-label={p.label}
                  title={p.label}
                  onClick={() => bgSetting.set(p.id)}
                  style={bgStyle({ kind: "preset", id: p.id }, "")}
                  className={`clip-chamfer-sm h-10 outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                    isPreset(p.id) ? "ring-2 ring-inset ring-accent" : "opacity-80 hover:opacity-100"
                  }`}
                />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
              <label
                title="Chọn màu tuỳ ý"
                className={`clip-chamfer-sm relative flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 font-display text-[13px] font-medium tracking-wide transition hover:bg-white/15 ${
                  choice.kind === "color" ? "bg-accent text-black" : "bg-white/[0.07] text-white/80"
                }`}
              >
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-sm border border-white/40"
                  style={{ background: currentColor }}
                />
                Màu
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => bgSetting.set(`color:${e.target.value}`)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Chọn màu nền"
                />
              </label>

              <button
                type="button"
                onClick={() => (image && choice.kind !== "image" ? bgSetting.set("image") : fileRef.current?.click())}
                aria-pressed={choice.kind === "image"}
                title={image ? "Dùng lại ảnh đã chọn" : "Chọn ảnh từ máy của bạn"}
                className={`clip-chamfer-sm flex h-9 flex-1 items-center justify-center gap-2 font-display text-[13px] font-medium tracking-wide outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                  choice.kind === "image" ? "bg-accent text-black" : "bg-white/[0.07] text-white/80 hover:bg-white/15"
                }`}
              >
                Ảnh
              </button>
            </div>

            {image && (
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-white/45">
                <button type="button" onClick={() => fileRef.current?.click()} className="hover:text-white">
                  Chọn ảnh khác
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bgImageSetting.clear();
                    if (choice.kind === "image") bgSetting.set("glow");
                  }}
                  className="hover:text-white"
                >
                  Xoá ảnh
                </button>
              </div>
            )}

            {notice && <p className="mt-2 text-xs text-amber-300/90">{notice}</p>}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
