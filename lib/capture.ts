/**
 * Chụp / xuất ảnh nhân vật từ khung viewer.
 *
 * Mỗi renderer (Spine, Live2D) đăng ký một `CaptureFn`: vẽ lại đúng khung nhìn hiện tại (zoom, kéo, tư thế đang chạy) ở kích thước đích
 * rồi trả về canvas nền trong suốt. Nền (nếu muốn kèm) được dựng riêng từ các phần tử nền đang hiển thị trong khung, rồi ghép dưới nhân vật.
 */

/** Vẽ nhân vật (nền trong suốt) ở kích thước `width`×`height` điểm ảnh; có thể trả canvas nhỏ hơn nếu GPU không vẽ nổi cỡ đó, hoặc null nếu chưa sẵn sàng. */
export type CaptureFn = (size: CaptureSize) => Promise<HTMLCanvasElement | null>;

/**
 * `fit`: "height" = vùng nhìn thấy vừa chiều cao ảnh (nhân vật lớn; ảnh dọc thì bị cắt hai bên, ảnh ngang thì thêm nền hai bên);
 * "contain" = toàn bộ vùng đang nhìn thấy nằm gọn trong ảnh (không cắt gì, thừa chỗ nào thì thêm nền).
 */
export type CaptureSize = { width: number; height: number; fit?: Fit };
export type Fit = "height" | "contain";

/** Hệ số phóng so với khung đang xem để vùng trống (`availW`×`availH`, px CSS) khớp ảnh `W`×`H`. */
export const captureScale = (W: number, H: number, availW: number, availH: number, fit: Fit = "height") =>
  fit === "contain" ? Math.min(W / availW, H / availH) : H / availH;

export type SizePreset = { id: string; label: string; hint?: string; width?: number; height?: number };

/** `current` = đúng kích thước khung đang xem (nhân với devicePixelRatio). */
export const SIZE_PRESETS: SizePreset[] = [
  { id: "current", label: "Như đang xem", hint: "kích thước khung hiện tại" },
  { id: "fhd", label: "Full HD", hint: "1920×1080", width: 1920, height: 1080 },
  { id: "qhd", label: "2K", hint: "2560×1440", width: 2560, height: 1440 },
  { id: "uhd", label: "4K", hint: "3840×2160", width: 3840, height: 2160 },
  { id: "phone", label: "Điện thoại", hint: "1080×2340", width: 1080, height: 2340 },
  { id: "square", label: "Vuông", hint: "1080×1080", width: 1080, height: 1080 },
];

export type Format = "png" | "jpeg" | "webp";
export const FORMATS: { id: Format; label: string; mime: string; ext: string; alpha: boolean }[] = [
  { id: "png", label: "PNG", mime: "image/png", ext: "png", alpha: true },
  { id: "webp", label: "WebP", mime: "image/webp", ext: "webp", alpha: true },
  { id: "jpeg", label: "JPG", mime: "image/jpeg", ext: "jpg", alpha: false },
];

const MAX_SIDE = 4096;

export function sizeForPreset(preset: SizePreset, stage: HTMLElement): { width: number; height: number } {
  if (preset.width && preset.height) return { width: preset.width, height: preset.height };
  const dpr = window.devicePixelRatio || 1;
  let width = Math.max(1, Math.round(stage.clientWidth * dpr));
  let height = Math.max(1, Math.round(stage.clientHeight * dpr));
  const long = Math.max(width, height);
  if (long > MAX_SIDE) {
    width = Math.round((width * MAX_SIDE) / long);
    height = Math.round((height * MAX_SIDE) / long);
  }
  return { width, height };
}

/** Thu về cạnh dài tối đa `max` (giữ tỉ lệ), dùng cho ảnh xem trước. */
export function fitWithin(size: { width: number; height: number }, max: number) {
  const k = Math.min(1, max / Math.max(size.width, size.height));
  return { width: Math.max(1, Math.round(size.width * k)), height: Math.max(1, Math.round(size.height * k)) };
}

export const safeFileName = (s: string) =>
  s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "nhan-vat";

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality = 0.92): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), mime, quality);
    } catch {
      resolve(null); // canvas bị "nhiễm" (tainted) thì không xuất được
    }
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Ảnh nền `url(...)` không phải data: được nhúng thành data URL, vì SVG-làm-ảnh không tự tải được tài nguyên ngoài. */
async function inlineUrls(css: string): Promise<string> {
  const re = /url\((['"]?)(.*?)\1\)/g;
  const found = [...css.matchAll(re)];
  let out = css;
  for (const m of found) {
    const url = m[2];
    if (url.startsWith("data:")) continue;
    const blob = await (await fetch(url)).blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    out = out.replace(m[0], `url("${data}")`);
  }
  return out;
}

async function drawCss(ctx: CanvasRenderingContext2D, css: string, x: number, y: number, w: number, h: number, opacity: number) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}">` +
    `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="${esc(`width:100%;height:100%;${css}`)}"></div></foreignObject></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  ctx.globalAlpha = opacity;
  ctx.drawImage(img, x, y, w, h);
  ctx.globalAlpha = 1;
}

/**
 * Dựng lại nền của khung lên canvas `width`×`height`: màu nền của khung rồi lần lượt từng phần tử nền (gradient, màu, ảnh) trong `root`.
 * Trả null nếu nền có thành phần không vẽ lại được (ảnh/canvas/video như tranh nền của Ultimate) hoặc trình duyệt không cho vẽ.
 */
export async function renderBackdrop(stage: HTMLElement, root: HTMLElement | null, width: number, height: number): Promise<HTMLCanvasElement | null> {
  if (!root) return null;
  try {
    if (root.querySelector("img, canvas, video, svg, picture")) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = getComputedStyle(stage).backgroundColor || "#05070a";
    ctx.fillRect(0, 0, width, height);

    const s = stage.getBoundingClientRect();
    const sx = width / Math.max(1, s.width);
    const sy = height / Math.max(1, s.height);
    for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
      const cs = getComputedStyle(el);
      const hasImage = cs.backgroundImage !== "none";
      const hasColor = !/^rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor) && cs.backgroundColor !== "transparent";
      if ((!hasImage && !hasColor) || cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const css = await inlineUrls(
        [
          hasColor ? `background-color:${cs.backgroundColor}` : "",
          hasImage ? `background-image:${cs.backgroundImage}` : "",
          `background-size:${cs.backgroundSize}`,
          `background-position:${cs.backgroundPosition}`,
          `background-repeat:${cs.backgroundRepeat}`,
        ]
          .filter(Boolean)
          .join(";"),
      );
      await drawCss(ctx, css, (r.left - s.left) * sx, (r.top - s.top) * sy, r.width * sx, r.height * sy, Number(cs.opacity) || 1);
    }
    return canvas;
  } catch {
    return null;
  }
}
