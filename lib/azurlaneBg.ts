import { useSyncExternalStore, type CSSProperties } from "react";
import { createSetting } from "./createSetting";

export type AzurBg = { id: string; label: string; background: string };

/** Nền viewer Azur Lane: mỗi nền là một giá trị CSS `background`, dùng chung cho nền thật và ô xem trước. Phần sáng nằm ở dưới để chữ và dock luôn đọc được. */
export const AZUR_BGS: AzurBg[] = [
  {
    id: "ocean",
    label: "Biển đêm",
    background: "radial-gradient(60% 55% at 55% 45%, rgba(56,189,248,0.22), transparent 72%), linear-gradient(180deg, #0f2447, #081426)",
  },
  { id: "deep", label: "Vực sâu", background: "radial-gradient(70% 55% at 50% 35%, #123a63 0%, transparent 75%), linear-gradient(180deg, #06101f, #020711)" },
  { id: "dawn", label: "Bình minh", background: "linear-gradient(180deg, #1b2a5c 0%, #5d6fb0 50%, #f0a98a 100%)" },
  { id: "dusk", label: "Hoàng hôn", background: "linear-gradient(180deg, #2b1c4d 0%, #8a3f6b 55%, #f08a5d 100%)" },
  { id: "foam", label: "Bọt sóng", background: "radial-gradient(70% 55% at 50% 28%, rgba(255,255,255,0.9), transparent 72%), linear-gradient(180deg, #dcecf8 0%, #9fc6e3 100%)" },
  { id: "steel", label: "Thép", background: "radial-gradient(80% 70% at 50% 40%, #3b4656 0%, #151b25 100%)" },
  { id: "dark", label: "Tối", background: "#05080f" },
  { id: "checker", label: "Trong suốt", background: "conic-gradient(#2a3342 25%, #1a212d 0 50%, #2a3342 0 75%, #1a212d 0) 0 0 / 28px 28px" },
];

export const AZUR_DEFAULT_BG = "ocean";
/** Giá trị lưu: id nền dựng sẵn, "color:#rrggbb" hoặc "image" (ảnh ở azurBgImageSetting). */
export const azurBgSetting = createSetting("azurlane-viewer:bg", AZUR_DEFAULT_BG);
export const azurBgImageSetting = createSetting("azurlane-viewer:bg-image", "");

export type AzurBgChoice = { kind: "preset"; id: string } | { kind: "color"; value: string } | { kind: "image" };

export function parseAzurBg(raw: string, hasImage: boolean): AzurBgChoice {
  if (raw === "image" && hasImage) return { kind: "image" };
  if (/^color:#[0-9a-f]{6}$/i.test(raw)) return { kind: "color", value: raw.slice(6) };
  return { kind: "preset", id: (AZUR_BGS.find((b) => b.id === raw) ?? AZUR_BGS[0]).id };
}

export function azurBgStyle(choice: AzurBgChoice, image: string): CSSProperties {
  if (choice.kind === "image") return { background: `linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), url("${image}") center / cover no-repeat, #05080f` };
  if (choice.kind === "color") return { background: `radial-gradient(90% 80% at 50% 40%, rgba(255,255,255,0.06), rgba(0,0,0,0.35)), ${choice.value}` };
  return { background: AZUR_BGS.find((b) => b.id === choice.id)!.background };
}

/** Chuyển sang nền dựng sẵn kế tiếp (đang dùng màu hoặc ảnh thì về nền đầu tiên). */
export function cycleAzurBg() {
  const cur = parseAzurBg(azurBgSetting.get(), azurBgImageSetting.get() !== "");
  const i = cur.kind === "preset" ? AZUR_BGS.findIndex((b) => b.id === cur.id) : -1;
  azurBgSetting.set(AZUR_BGS[(i + 1) % AZUR_BGS.length].id);
}

export function useAzurBg() {
  const raw = useSyncExternalStore(azurBgSetting.subscribe, azurBgSetting.get, () => AZUR_DEFAULT_BG);
  const image = useSyncExternalStore(azurBgImageSetting.subscribe, azurBgImageSetting.get, () => "");
  const choice = parseAzurBg(raw, image !== "");
  return { choice, image, style: azurBgStyle(choice, image) };
}
