/**
 * Phần dùng chung của các script Azur Lane: thư mục dữ liệu thô, bảng của AzurLaneData và cách tìm skin theo tên bundle.
 * AzurLaneData (github.com/AzurLaneTools/AzurLaneData) là bản JSON của các bảng cấu hình trong game; ở đây dùng bảng EN.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CACHE = process.env.AZL_CACHE ?? join(homedir(), "Developer", "Personal", ".azl-cache");
export const DATA_DIR = join(CACHE, "azl-data");
export const UA = "interactive-anime-local-fetch (personal fan project)";
const RAW = "https://raw.githubusercontent.com/AzurLaneTools/AzurLaneData/main";

/** Tải (một lần) rồi đọc một bảng, ví dụ table("ship_skin_template", "EN/ShareCfg/ship_skin_template.json"). */
export async function table(name, path) {
  mkdirSync(DATA_DIR, { recursive: true });
  const file = join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) {
    const res = await fetch(`${RAW}/${path}`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

export const skinTemplate = () => table("ship_skin_template", "EN/ShareCfg/ship_skin_template.json");
export const skinWords = () => table("ship_skin_words", "EN/sharecfgdata/ship_skin_words.json");

/**
 * Skin trong ship_skin_template ứng với một bundle Live2D (cột `painting` = tên bundle, không phân biệt hoa thường). Vài bundle có nhiều dòng cùng
 * `painting` (bản gốc và bản trong sự kiện): bỏ dòng có tên là mã thay thế ({namecode:..}), và nếu còn nhiều tên khác nhau thì ưu tiên tên KHÁC tên tàu
 * (tên của chính skin, không phải dòng "mặc định" của tàu).
 */
export function skinForBundle(template, bundle, shipName) {
  const rows = Object.values(template).filter((s) => String(s.painting).toLowerCase() === bundle.toLowerCase() && !String(s.name).includes("{"));
  if (!rows.length) return undefined;
  return rows.find((s) => s.name !== shipName) ?? rows[0];
}
