import { useSyncExternalStore, type CSSProperties } from "react";
import { createSetting } from "./createSetting";

export type BgPreset = { id: string; label: string; background: string };

const GRID = (a: number) =>
  `linear-gradient(rgba(255,255,255,${a}) 1px, transparent 1px) 0 0 / 32px 32px, linear-gradient(90deg, rgba(255,255,255,${a}) 1px, transparent 1px) 0 0 / 32px 32px`;

/**
 * Các nền dựng sẵn. Mỗi nền là một giá trị CSS `background` duy nhất để dùng chung cho nền viewer lẫn ô xem trước.
 * Phần sáng của gradient đặt ở dưới để chữ ở góc trên và dock (kính tối) luôn đọc được.
 */
export const BG_PRESETS: BgPreset[] = [
  {
    id: "glow",
    label: "Theo nguyên tố",
    // Quầng sáng theo màu accent của nhân vật (biến --accent đã gán cho cả trang).
    background: `radial-gradient(80% 60% at 50% 38%, color-mix(in srgb, var(--accent) 38%, transparent), transparent 70%), ${GRID(0.045)}, #05070a`,
  },
  { id: "dark", label: "Tối", background: "#05070a" },
  { id: "grid", label: "Lưới", background: `${GRID(0.08)}, #070a0f` },
  {
    id: "sunset",
    label: "Hoàng hôn",
    background: "linear-gradient(170deg, #1c0f3a 0%, #5b2a6e 45%, #d4603e 100%)",
  },
  {
    id: "neon",
    label: "Neon",
    background:
      "radial-gradient(60% 50% at 25% 30%, rgba(0,229,255,0.32), transparent 70%), radial-gradient(60% 50% at 78% 72%, rgba(255,0,170,0.28), transparent 70%), #070816",
  },
  {
    id: "ice",
    label: "Băng",
    background: "linear-gradient(180deg, #08172b 0%, #17476b 62%, #6fb5d8 100%)",
  },
  {
    id: "grey",
    label: "Xám",
    background: "radial-gradient(80% 70% at 50% 40%, #3b424e 0%, #171b22 100%)",
  },
  {
    id: "checker",
    label: "Trong suốt",
    // Ô caro: nhìn rõ viền nhân vật, hữu ích để xem hình bóng.
    background: "conic-gradient(#2c323c 25%, #1c2027 0 50%, #2c323c 0 75%, #1c2027 0) 0 0 / 28px 28px",
  },
];

export const DEFAULT_BG = "glow";

/** Giá trị lưu: id preset ("glow"), "color:#rrggbb", hoặc "image" (ảnh nằm ở bgImageSetting). */
export const bgSetting = createSetting("nikke-viewer:bg", DEFAULT_BG);
/** Ảnh nền người dùng chọn (data URL đã thu nhỏ). */
export const bgImageSetting = createSetting("nikke-viewer:bg-image", "");

export type BgChoice =
  | { kind: "preset"; id: string }
  | { kind: "color"; value: string }
  | { kind: "image" };

export function parseBg(raw: string, hasImage: boolean): BgChoice {
  if (raw === "image" && hasImage) return { kind: "image" };
  if (/^color:#[0-9a-f]{6}$/i.test(raw)) return { kind: "color", value: raw.slice(6) };
  const preset = BG_PRESETS.find((p) => p.id === raw);
  return { kind: "preset", id: (preset ?? BG_PRESETS[0]).id };
}

export function bgStyle(choice: BgChoice, image: string): CSSProperties {
  if (choice.kind === "image") {
    // Phủ một lớp tối nhẹ để chữ và giao diện không chìm vào ảnh sáng.
    return { background: `linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), url("${image}") center / cover no-repeat, #05070a` };
  }
  if (choice.kind === "color") {
    return { background: `radial-gradient(90% 80% at 50% 40%, rgba(255,255,255,0.06), rgba(0,0,0,0.35)), ${choice.value}` };
  }
  return { background: BG_PRESETS.find((p) => p.id === choice.id)!.background };
}

/** Thu nhỏ ảnh về tối đa 1920px, JPEG q0.85: đủ đẹp mà vừa với localStorage. */
export async function imageFileToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Chuyển sang preset kế tiếp (đang dùng màu/ảnh thì về preset đầu tiên). Tham chiếu ổn định, đọc trạng thái hiện tại từ store. */
export function cycleBackground() {
  const current = parseBg(bgSetting.get(), bgImageSetting.get() !== "");
  const i = current.kind === "preset" ? BG_PRESETS.findIndex((p) => p.id === current.id) : -1;
  bgSetting.set(BG_PRESETS[(i + 1) % BG_PRESETS.length].id);
}

export function useViewerBg() {
  const raw = useSyncExternalStore(bgSetting.subscribe, bgSetting.get, () => DEFAULT_BG);
  const image = useSyncExternalStore(bgImageSetting.subscribe, bgImageSetting.get, () => "");
  const choice = parseBg(raw, image !== "");
  return { choice, image, style: bgStyle(choice, image) };
}
