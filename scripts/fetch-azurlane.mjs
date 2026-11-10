#!/usr/bin/env node
/**
 * Dựng dữ liệu Azur Lane (LOCAL) từ các mô hình Live2D đã tách + dữ liệu tàu của cộng đồng.
 *  - Mô hình: public/assets/azurlane/<bundle>/ (do scripts/azurlane/extract-live2d.py tạo; xem README mục Azur Lane).
 *  - Tên tàu, hệ, loại, độ hiếm, tên skin, ảnh: AzurAPI (github.com/AzurAPI/azurapi-js-setup, ships.json), lưu đệm ở ~/Developer/Personal/.azl-cache.
 *  - Ảnh thẻ: ảnh của skin từ AzurAPI, cắt tỉ lệ 3:4 (từ trên xuống) rồi nén WebP tại public/assets/azurlane/<bundle>/thumb.webp.
 *  - Kết quả: data/azurlane.local.json (đã gitignore).
 * Asset thuộc Manjuu / Yostar: chỉ dùng local (public/assets/ và data/*.local.json đã nằm trong .gitignore).
 *
 * Tên bundle là pinyin tên Trung của tàu + số thứ tự skin (vd "lafei_4"). Bundle nào không có trong scripts/azurlane/selection.json sẽ bị bỏ qua.
 *
 *   node scripts/fetch-azurlane.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = join(ROOT, "public", "assets", "azurlane");
const OUT = join(ROOT, "data", "azurlane.local.json");
const CACHE = process.env.AZL_CACHE ?? join(homedir(), "Developer", "Personal", ".azl-cache");
const SHIPS_URL = "https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/ships.json";
const UA = "interactive-anime-local-fetch (personal fan project)";

/**
 * Danh sách bundle muốn có: scripts/azurlane/selection.json, mỗi mục { bundle, ship (tên EN trong AzurAPI), skin (tên skin trong AzurAPI hoặc null) }.
 * Sinh tự động bằng match-bundles.py --select (có thể sửa tay). skin = null: skin chưa biết tên (mới hơn dữ liệu AzurAPI hoặc không chắc thứ tự):
 * đặt tên trung tính "Skin <số>" và ảnh thẻ dựng từ chính Live2D (scripts/azurlane/render-thumbs.mjs).
 */
const SELECTION = JSON.parse(readFileSync(join(ROOT, "scripts", "azurlane", "selection.json"), "utf8"));
const BUNDLES = Object.fromEntries(SELECTION.map((e) => [e.bundle, { ship: e.ship, skin: e.skin }]));

/** "qiye_7" → "Skin 7", "tiancheng_cv_2" → "Skin cv 2". */
const neutralName = (bundle) => `Skin ${(/^.+?_((?:cv_)?\d+(?:_[a-z0-9]+)?)$/.exec(bundle)?.[1] ?? bundle).replace(/_/g, " ")}`;

const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function ships() {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, "azurapi-ships.json");
  if (!existsSync(file)) {
    const res = await fetch(SHIPS_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status} ${SHIPS_URL}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

async function thumb(url, dest) {
  if (existsSync(dest)) return true;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const img = sharp(Buffer.from(await res.arrayBuffer()));
  const { width, height } = await img.metadata();
  // Ảnh toàn thân: lấy phần trên theo tỉ lệ 3:4 (đầu và thân trên), như thẻ nhân vật của hai game kia.
  const h = Math.min(height, Math.round((width * 4) / 3));
  await img.extract({ left: 0, top: 0, width, height: h }).resize({ width: 480, height: 640, fit: "cover", position: "top" }).webp({ quality: 85 }).toFile(dest);
  return true;
}

// Voice (scripts/azurlane/voice.mjs): bundle → mã voice, mã voice → { cue: { src, text } }.
const VOICE_FILE = join(ROOT, "data", "azurlane.voice.local.json");
const VOICE = existsSync(VOICE_FILE) ? JSON.parse(readFileSync(VOICE_FILE, "utf8")) : { bundles: {}, sets: {} };

const all = await ships();
const present = readdirSync(ASSET_DIR, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(ASSET_DIR, e.name, "info.json"))).map((e) => e.name);
const skipped = present.filter((b) => !BUNDLES[b]);
if (skipped.length) console.log(`Bỏ qua (chưa khai báo trong BUNDLES): ${skipped.join(", ")}`);

const byShip = new Map();
for (const bundle of present.filter((b) => BUNDLES[b])) {
  const { ship: en, skin: officialName } = BUNDLES[bundle];
  const skinName = officialName ?? neutralName(bundle);
  const s = all.find((x) => x.names.en === en);
  if (!s) {
    console.warn(`! Không thấy tàu "${en}" trong AzurAPI (${bundle})`);
    continue;
  }
  const skin = s.skins.find((k) => k.name === skinName);
  const info = JSON.parse(readFileSync(join(ASSET_DIR, bundle, "info.json"), "utf8"));
  const dest = join(ASSET_DIR, bundle, "thumb.webp");
  // Skin không có ảnh trong AzurAPI: dùng ảnh đã dựng từ Live2D nếu có (scripts/azurlane/render-thumbs.mjs).
  const ok = skin?.image ? await thumb(skin.image, dest) : existsSync(dest);
  if (!ok) console.warn(`! Chưa có ảnh của ${en} / ${skinName} (chạy scripts/azurlane/render-thumbs.mjs rồi chạy lại script này)`);
  const entry = byShip.get(s.id) ?? {
    id: `azurlane-${s.id}`,
    slug: slugify(en),
    name: en,
    names: s.names,
    nation: s.nationality,
    hull: s.hullType,
    rarity: s.rarity,
    stars: s.stars,
    skins: [],
  };
  entry.skins.push({
    id: bundle,
    name: skinName,
    model: `/assets/azurlane/${bundle}/${bundle}.model3.json`,
    thumb: ok ? `/assets/azurlane/${bundle}/thumb.webp` : "",
    motions: Object.keys(info.motions),
    hitAreas: info.hitAreas,
    ...(VOICE.sets[VOICE.bundles[bundle]] ? { voice: VOICE.sets[VOICE.bundles[bundle]] } : {}),
  });
  byShip.set(s.id, entry);
}
const list = [...byShip.values()].map((s) => ({ ...s, skins: s.skins.sort((a, b) => (a.name === "Default" ? -1 : b.name === "Default" ? 1 : a.id.localeCompare(b.id, undefined, { numeric: true }))) }));
list.sort((a, b) => a.name.localeCompare(b.name));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(list, null, 2) + "\n");
console.log(`Đã ghi ${list.length} tàu, ${list.reduce((n, s) => n + s.skins.length, 0)} skin → data/azurlane.local.json`);
