"use client";

import { useEffect, useRef, useState } from "react";
import { AZUR_BGS, azurBgImageSetting, azurBgSetting, azurBgStyle, useAzurBg } from "@/lib/azurlaneBg";
import { imageFileToDataUrl } from "@/lib/viewerBg";
import { ToolButton } from "../ViewerStage";

/** Nền phía sau tàu theo lựa chọn của người dùng (lưu ở localStorage). */
export function AzurBackdrop() {
  const { style } = useAzurBg();
  return <div className="absolute inset-0 transition-[background] duration-500" style={style} />;
}

/** Nút "Nền" ở thanh công cụ: bảng nền dựng sẵn, màu tuỳ chọn hoặc ảnh của bạn. */
export function AzurBackgroundPicker() {
  const { choice, image } = useAzurBg();
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
      const saved = azurBgImageSetting.set(await imageFileToDataUrl(file));
      azurBgSetting.set("image");
      setNotice(saved ? null : "Ảnh quá lớn để lưu lâu dài, chỉ dùng trong phiên này.");
    } catch {
      setNotice("Không đọc được ảnh này.");
    }
  };

  const currentColor = choice.kind === "color" ? choice.value : "#12305a";
  const active = choice.kind === "preset" ? choice.id : null;
  const wide = "azl-chip relative flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 text-[13px] font-semibold outline-none focus-within:ring-2 focus-within:ring-accent";

  return (
    <div ref={wrapRef} className="relative">
      <ToolButton label="Đổi nền (phím B)" onClick={() => setOpen((v) => !v)} pressed={open}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m21 16-5-5-8 9" />
        </svg>
      </ToolButton>

      {open && (
        <div role="dialog" aria-label="Chọn nền viewer" className="azl-glass absolute right-full top-1/2 mr-3 w-[248px] -translate-y-1/2 p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Nền</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Nền dựng sẵn">
            {AZUR_BGS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                role="radio"
                aria-checked={bg.id === active}
                aria-label={bg.label}
                title={bg.label}
                onClick={() => azurBgSetting.set(bg.id)}
                style={azurBgStyle({ kind: "preset", id: bg.id }, "")}
                className={`h-10 rounded-md border-2 outline-none transition focus-visible:ring-2 focus-visible:ring-accent ${bg.id === active ? "border-accent" : "border-transparent opacity-80 hover:opacity-100"}`}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <label className={wide} data-active={choice.kind === "color"} title="Chọn màu tuỳ ý">
              <span aria-hidden className="h-4 w-4 rounded-sm border border-white/40" style={{ background: currentColor }} />
              Màu
              <input type="color" value={currentColor} onChange={(e) => azurBgSetting.set(`color:${e.target.value}`)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Chọn màu nền" />
            </label>
            <button
              type="button"
              data-active={choice.kind === "image"}
              onClick={() => (image && choice.kind !== "image" ? azurBgSetting.set("image") : fileRef.current?.click())}
              title={image ? "Dùng lại ảnh đã chọn" : "Chọn ảnh từ máy của bạn"}
              className={wide}
            >
              Ảnh
            </button>
          </div>

          {image && (
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
              <button type="button" onClick={() => fileRef.current?.click()} className="hover:text-foreground">
                Chọn ảnh khác
              </button>
              <button
                type="button"
                onClick={() => {
                  azurBgImageSetting.clear();
                  if (choice.kind === "image") azurBgSetting.set("ocean");
                }}
                className="hover:text-foreground"
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
      )}
    </div>
  );
}
