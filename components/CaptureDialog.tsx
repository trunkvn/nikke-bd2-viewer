"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  canvasToBlob,
  fitWithin,
  FORMATS,
  renderBackdrop,
  safeFileName,
  SIZE_PRESETS,
  sizeForPreset,
  type CaptureFn,
  type Fit,
  type Format,
} from "@/lib/capture";

type Composed = { canvas: HTMLCanvasElement; bgFailed: boolean };

/** Nhân vật (trong suốt) + nền tuỳ chọn; `flatten` (JPG) thì luôn có nền, nếu không dựng được nền thì tô đen. */
async function compose(
  capture: CaptureFn,
  stage: HTMLElement,
  backdrop: HTMLElement | null,
  size: { width: number; height: number },
  fit: Fit,
  withBg: boolean,
  flatten: boolean,
): Promise<Composed | null> {
  const subject = await capture({ ...size, fit });
  if (!subject) return null;
  if (!withBg && !flatten) return { canvas: subject, bgFailed: false };
  const out = document.createElement("canvas");
  out.width = subject.width;
  out.height = subject.height;
  const ctx = out.getContext("2d")!;
  const wantBg = withBg || flatten;
  const bg = wantBg ? await renderBackdrop(stage, backdrop, out.width, out.height) : null;
  if (bg) ctx.drawImage(bg, 0, 0);
  else if (flatten) {
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(subject, 0, 0);
  return { canvas: out, bgFailed: wantBg && !bg };
}

const choice = "rounded-md border px-3 py-1.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent";
const on = "border-accent bg-accent/15 text-white";
const off = "border-white/15 text-white/70 hover:border-white/35 hover:text-white";

/**
 * Hộp thoại chụp ảnh: chọn kích thước (kể cả cỡ hình nền), nền, định dạng; xem trước; tải về, sao chép hoặc chia sẻ.
 * Ảnh vẽ lại ở đúng kích thước đích (không phải phóng ảnh chụp màn hình) nên vẫn nét ở 2K/4K.
 */
export function CaptureDialog({
  capture,
  stage,
  backdrop,
  fileBase,
  onClose,
}: {
  capture: CaptureFn;
  stage: HTMLElement;
  /** Phần tử chứa nền của khung (để dựng lại nền); null = không có nền để kèm. */
  backdrop: HTMLElement | null;
  fileBase: string;
  onClose: () => void;
}) {
  const [presetId, setPresetId] = useState("current");
  const [fit, setFit] = useState<Fit>("height");
  const [withBg, setWithBg] = useState(backdrop !== null);
  const [format, setFormat] = useState<Format>("png");
  const [preview, setPreview] = useState<{ key: string; url: string; note: string | null } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [canCopy] = useState(() => typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write);
  const [canShare] = useState(
    () => typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] }),
  );
  const closeRef = useRef<HTMLButtonElement>(null);

  const preset = SIZE_PRESETS.find((p) => p.id === presetId) ?? SIZE_PRESETS[0];
  const fmt = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const flatten = !fmt.alpha;
  const key = `${presetId}|${fit}|${withBg}|${flatten}`;
  const target = sizeForPreset(preset, stage);

  // Esc đóng, và trả tiêu điểm về chỗ cũ khi đóng.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);

  // Ảnh xem trước (cạnh dài ≤ 640) dựng lại mỗi khi đổi lựa chọn.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const small = fitWithin(sizeForPreset(preset, stage), 640);
      const r = await compose(capture, stage, backdrop, small, fit, withBg, flatten);
      if (cancelled) return;
      setPreview({
        key,
        url: r ? r.canvas.toDataURL("image/png") : "",
        note: r?.bgFailed ? "Không dựng lại được nền này nên ảnh không kèm nền." : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [capture, stage, backdrop, preset, fit, withBg, flatten, key]);

  const busy = preview?.key !== key;

  const run = async (action: "download" | "copy" | "share") => {
    setWorking(true);
    setMessage(null);
    try {
      const r = await compose(capture, stage, backdrop, target, fit, withBg, flatten);
      if (!r) throw new Error("Nhân vật chưa sẵn sàng, thử lại sau giây lát.");
      const { width, height } = r.canvas;
      const name = `${safeFileName(fileBase)}-${width}x${height}.${fmt.ext}`;
      if (action === "copy") {
        const png = canvasToBlob(r.canvas, "image/png").then((b) => {
          if (!b) throw new Error("Trình duyệt không xuất được ảnh.");
          return b;
        });
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
        setMessage({ ok: true, text: `Đã sao chép ảnh ${width}×${height} vào clipboard.` });
        return;
      }
      const blob = await canvasToBlob(r.canvas, fmt.mime);
      if (!blob) throw new Error("Trình duyệt không xuất được ảnh (canvas bị chặn).");
      if (action === "share") {
        await navigator.share({ files: [new File([blob], name, { type: blob.type })], title: fileBase });
        setMessage({ ok: true, text: "Đã mở bảng chia sẻ." });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setMessage({ ok: true, text: `Đã lưu ${name}` });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // người dùng đóng bảng chia sẻ
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setWorking(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chụp ảnh nhân vật"
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0c0f16] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="font-display text-base font-semibold uppercase tracking-wider">Chụp ảnh</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 items-center justify-center rounded-md text-xl text-white/70 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-accent"
          >
            ×
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_20rem]">
          <div className="flex h-[38dvh] items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[repeating-conic-gradient(#1a1e29_0%_25%,#141824_0%_50%)] bg-[length:16px_16px] p-2 md:h-auto md:min-h-[20rem]">
            {preview?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước tạo tại chỗ (data URL), không qua trình tối ưu của Next
              <img
                src={preview.url}
                alt="Xem trước ảnh sẽ lưu"
                className={`max-h-[34dvh] max-w-full object-contain transition-opacity md:max-h-[56dvh] ${busy ? "opacity-40" : ""}`}
              />
            ) : (
              <span className="animate-blink font-mono text-xs uppercase tracking-[0.2em] text-white/50">
                {busy ? "Đang dựng ảnh…" : "Nhân vật chưa sẵn sàng"}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-4 text-sm">
            <fieldset>
              <legend className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Kích thước</legend>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={p.id === presetId}
                    title={p.hint}
                    onClick={() => setPresetId(p.id)}
                    className={`${choice} ${p.id === presetId ? on : off}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-white/45">
                {target.width}×{target.height} px
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Khung hình</legend>
              <div className="flex gap-1.5">
                <button type="button" aria-pressed={fit === "height"} onClick={() => setFit("height")} className={`${choice} ${fit === "height" ? on : off}`}>
                  Vừa chiều cao
                </button>
                <button type="button" aria-pressed={fit === "contain"} onClick={() => setFit("contain")} className={`${choice} ${fit === "contain" ? on : off}`}>
                  Vừa toàn bộ
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-white/45">
                {fit === "height" ? "Nhân vật lớn nhất có thể; ảnh dọc bị cắt hai bên." : "Giữ nguyên những gì đang thấy; ảnh khác tỉ lệ sẽ có thêm nền ở lề."}
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Nền</legend>
              <div className="flex gap-1.5">
                <button type="button" aria-pressed={!withBg && !flatten} disabled={flatten} onClick={() => setWithBg(false)} className={`${choice} ${!withBg && !flatten ? on : off} disabled:opacity-40`}>
                  Trong suốt
                </button>
                <button type="button" aria-pressed={withBg || flatten} disabled={backdrop === null} onClick={() => setWithBg(true)} className={`${choice} ${withBg || flatten ? on : off} disabled:opacity-40`}>
                  Kèm nền
                </button>
              </div>
              {backdrop === null && <p className="mt-1.5 text-[11px] text-white/45">Khung này không có nền để kèm.</p>}
              {flatten && <p className="mt-1.5 text-[11px] text-white/45">JPG không có độ trong suốt nên luôn kèm nền.</p>}
              {preview?.note && <p className="mt-1.5 text-[11px] text-amber-300/90">{preview.note}</p>}
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Định dạng</legend>
              <div className="flex gap-1.5">
                {FORMATS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={f.id === format} onClick={() => setFormat(f.id)} className={`${choice} ${f.id === format ? on : off}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-auto flex flex-col gap-2">
              <button
                type="button"
                disabled={working}
                onClick={() => void run("download")}
                className="rounded-md bg-accent px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-black outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
              >
                {working ? "Đang xử lý…" : "Tải ảnh về máy"}
              </button>
              {(canCopy || canShare) && (
                <div className="flex gap-2">
                  {canCopy && (
                    <button type="button" disabled={working} onClick={() => void run("copy")} className={`${choice} ${off} flex-1 disabled:opacity-60`}>
                      Sao chép
                    </button>
                  )}
                  {canShare && (
                    <button type="button" disabled={working} onClick={() => void run("share")} className={`${choice} ${off} flex-1 disabled:opacity-60`}>
                      Chia sẻ
                    </button>
                  )}
                </div>
              )}
              <p role="status" aria-live="polite" className={`min-h-[1.25rem] text-[12px] ${message ? (message.ok ? "text-emerald-300" : "text-red-300") : "text-transparent"}`}>
                {message?.text ?? "."}
              </p>
              <p className="text-[11px] leading-relaxed text-white/45">
                Làm hình nền: chọn cỡ Full HD/2K/4K (máy tính) hoặc Điện thoại, tải ảnh về rồi đặt trong cài đặt hình nền của máy. Trên điện thoại, nút
                Chia sẻ có thể có sẵn lựa chọn đặt làm hình nền. Trình duyệt không tự đặt được hình nền thay bạn.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
