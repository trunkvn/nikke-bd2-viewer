#!/usr/bin/env node
/**
 * Dựng dữ liệu Azur Lane (LOCAL) từ các mô hình Live2D đã tách + dữ liệu tàu của cộng đồng.
 *  - Mô hình: public/assets/azurlane/<bundle>/ (do scripts/azurlane/extract-live2d.py tạo; xem README mục Azur Lane).
 *  - Tên tàu, hệ, loại, độ hiếm, tên skin, ảnh: AzurAPI (github.com/AzurAPI/azurapi-js-setup, ships.json), lưu đệm ở ~/Developer/Personal/.azl-cache.
 *  - Ảnh thẻ: ảnh của skin từ AzurAPI, cắt tỉ lệ 3:4 (từ trên xuống) rồi nén WebP tại public/assets/azurlane/<bundle>/thumb.webp.
 *  - Kết quả: data/azurlane.local.json (đã gitignore).
 * Asset thuộc Manjuu / Yostar: chỉ dùng local (public/assets/ và data/*.local.json đã nằm trong .gitignore).
 *
 * Tên bundle là pinyin tên Trung của tàu + số thứ tự skin (vd "lafei_4"). Hiện bảng ghép bundle → tàu/skin ở dưới được khai báo tay cho các
 * mô hình đã chọn (xem scripts/azurlane/match-bundles.py để tìm bundle của một tàu); bundle chưa khai báo sẽ bị bỏ qua (và được liệt kê để bổ sung).
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

/** bundle → { ship: tên EN trong AzurAPI, skin: tên skin trong AzurAPI ("Default" cho bundle gốc) }. */
const BUNDLES = {
  lingbo: { ship: "Ayanami", skin: "Default" },
  lafei: { ship: "Laffey", skin: "Default" },
  lafei_4: { ship: "Laffey", skin: "White Rabbit Welcomes the Spring" },
  biaoqiang: { ship: "Javelin", skin: "Default" },
  biaoqiang_3: { ship: "Javelin", skin: "Beach Picnic!" },
  mingshi: { ship: "Akashi", skin: "Default" },
  z23: { ship: "Z23", skin: "Default" },
  xuefeng: { ship: "Yukikaze", skin: "Default" },
  // Eldridge có hai skin Live2D (_4 và _5): gán theo thứ tự trong dữ liệu (bundle tăng dần = thứ tự trong AzurAPI). Đã đối chiếu bằng mắt với
  // Shimakaze (daofeng_4 = cô phục vụ thỏ) và Eldridge (_4 = skin Tết); chỉ nên dựa vào quy ước này khi số bundle khớp số skin Live2D trong AzurAPI.
  aierdeliqi_4: { ship: "Eldridge", skin: "New Year's Outing" },
  aidang_2: { ship: "Atago", skin: "Summer March" },
  // Tàu hiếm (Ultra Rare / Priority / Super Rare) mà số bundle khớp đúng số skin Live2D trong AzurAPI (scripts/azurlane/match-bundles.py).
  kalangshitade_2: { ship: "Kronshtadt", skin: "Begin the Rush!" },
  qianwei_2: { ship: "Vanguard", skin: "Half-Hearted Masquerade" },
  daofeng_4: { ship: "Shimakaze", skin: "World's Speediest Bunny Waitress" },
  daofeng_5: { ship: "Shimakaze", skin: "The White Rabbit of Wonderland" },
  yichui_2: { ship: "Ibuki", skin: "Winter Sylph's Reverie" },
  luoen_4: { ship: "Roon", skin: "Viridescent Lullaby" },
  chicheng_5: { ship: "Akagi", skin: "Dawn-Phoenix's Summons" },
  beierfasite_2: { ship: "Belfast", skin: "Iridescent Rosa" },
  luoma_2: { ship: "Roma", skin: "White Heron of Darkest Night" },
  xianghe_2: { ship: "Shoukaku", skin: "The Crane that Dances With the Wind" },
  zhala_2: { ship: "Zara", skin: "Poolside Coincidence" },
  tierbici_2: { ship: "Tirpitz", skin: "Snow-Melting Summer" },
  lvzuofu_2: { ship: "Lützow", skin: "Everlasting Blood Banquet" },
  aisaikesi_4: { ship: "Essex", skin: "Craft Fairytail" },
  jiluofu_3: { ship: "Kirov", skin: "Drifting Justice" },
  tiancheng_3: { ship: "Amagi", skin: "Wending Waters, Serene Lotus" },
  // Hai bundle "cv" là skin mới hơn dữ liệu AzurAPI (2/2023) nên chưa có tên chính thức: đặt tên theo cảnh, ảnh thẻ dựng từ chính Live2D
  // (scripts/azurlane/render-thumbs.mjs). Hai bundle này dùng định dạng moc3 bản 4 và 5, có 37 và 62 hoạt cảnh.
  tiancheng_cv_2: { ship: "Amagi", skin: "Nhà thờ hoa hồng (cv 2)" },
  tiancheng_cv_3: { ship: "Amagi", skin: "Nàng tiên cá dưới biển (cv 3)" },
};

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

const all = await ships();
const present = readdirSync(ASSET_DIR, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(ASSET_DIR, e.name, "info.json"))).map((e) => e.name);
const skipped = present.filter((b) => !BUNDLES[b]);
if (skipped.length) console.log(`Bỏ qua (chưa khai báo trong BUNDLES): ${skipped.join(", ")}`);

const byShip = new Map();
for (const bundle of present.filter((b) => BUNDLES[b])) {
  const { ship: en, skin: skinName } = BUNDLES[bundle];
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
  });
  byShip.set(s.id, entry);
}
const list = [...byShip.values()].map((s) => ({ ...s, skins: s.skins.sort((a, b) => (a.name === "Default" ? -1 : b.name === "Default" ? 1 : a.id.localeCompare(b.id, undefined, { numeric: true }))) }));
list.sort((a, b) => a.name.localeCompare(b.name));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(list, null, 2) + "\n");
console.log(`Đã ghi ${list.length} tàu, ${list.reduce((n, s) => n + s.skins.length, 0)} skin → data/azurlane.local.json`);
