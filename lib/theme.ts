import type { CSSProperties } from "react";

export const DEFAULT_ACCENT = "#f5d90a";

const ELEMENT_COLOR: Record<string, string> = {
  Fire: "#ff6a3d",
  Water: "#3db5ff",
  Wind: "#4ade80",
  Iron: "#b388ff",
  Electric: "#ffe14d",
};

const RARITY_COLOR: Record<string, string> = {
  SSR: "#ffc93c",
  SR: "#b48cff",
  R: "#5cc8ff",
};

export const elementColor = (element?: string) => (element && ELEMENT_COLOR[element]) || DEFAULT_ACCENT;
export const rarityColor = (rarity: string) => RARITY_COLOR[rarity] ?? "#ffffff";

/** Ghi đè biến --accent cho một nhánh DOM; các class `bg-accent`, `text-accent`... tự đổi theo. */
export const accentStyle = (color: string): CSSProperties => ({ ["--accent" as string]: color });
