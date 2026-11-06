#!/usr/bin/env node
/**
 * Lấy kỹ năng của nhân vật từ wiki NIKKE (Fandom, nội dung CC BY-SA) để hiển thị trong ngăn INFO.
 *
 *   node scripts/fetch-skills.mjs                 # toàn bộ nhân vật trong data/nikke.local.json
 *   node scripts/fetch-skills.mjs --only rapi,neon    # chỉ vài nhân vật (id hoặc slug)
 *   node scripts/fetch-skills.mjs --dry-run       # xem độ phủ, không ghi/tải gì
 *   node scripts/fetch-skills.mjs --no-icons      # chỉ lấy chữ, bỏ qua biểu tượng
 *
 * Kết quả:
 *   data/nikke.skills.local.json                      { "<id nhân vật>": { burstStage, weapon, list: [...] } }
 *   public/assets/nikke/skill-icons/<tên>.webp        biểu tượng kỹ năng (96px), dùng chung giữa các nhân vật
 *
 * Biểu tượng là ảnh trong game (Shift Up), nên nằm trong public/assets/ (đã gitignore) cùng các asset khác.
 * Chạy lại an toàn: icon đã tải thì bỏ qua.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { fetchWikiMetaSmart } from "./lib/wiki-meta.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://nikke-goddess-of-victory-international.fandom.com/api.php";
const UA = "interactive-anime-local-fetch (personal fan project)";
const DATA = join(ROOT, "data", "nikke.local.json");
const OUT = join(ROOT, "data", "nikke.skills.local.json");
const ICON_DIR = join(ROOT, "public", "assets", "nikke", "skill-icons");
const ICON_URL = "/assets/nikke/skill-icons";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const dry = flag("dry-run");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(DATA)) {
  console.error("Chưa có data/nikke.local.json: chạy scripts/fetch-nikke.mjs trước.");
  process.exit(1);
}
const only = opt("only") ? new Set(opt("only").split(",").map((s) => s.trim())) : null;
const characters = JSON.parse(readFileSync(DATA, "utf8")).filter((c) => !only || only.has(c.id) || only.has(c.slug));

// ───────── 1. kỹ năng (chữ) ─────────
const names = [...new Set(characters.map((c) => c.name))];
console.log(`Tra wiki cho ${names.length} nhân vật...`);
const wiki = await fetchWikiMetaSmart(names);

const BURST = { 1: "I", 2: "II", 3: "III", all: "All", a: "All" };
const result = {};
const missing = [];
for (const c of characters) {
  const meta = wiki.get(c.name);
  if (!meta?.skills) {
    missing.push(`${c.name}${meta ? "" : " (không thấy trang)"}`);
    continue;
  }
  result[c.id] = {
    burstStage: meta.burst ? BURST[meta.burst.toLowerCase()] : undefined,
    weapon: meta.skills.weapon,
    list: meta.skills.list,
  };
}
console.log(`Có kỹ năng: ${Object.keys(result).length}/${characters.length}`);
if (missing.length) console.log(`Thiếu (${missing.length}): ${missing.join(", ")}`);

// ───────── 2. biểu tượng ─────────
const slugOf = (file) => file.replace(/\.\w+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

if (!flag("no-icons")) {
  const files = [...new Set(Object.values(result).flatMap((r) => r.list.map((s) => s.iconFile)).filter(Boolean))];
  const todo = files.filter((f) => !existsSync(join(ICON_DIR, `${slugOf(f)}.webp`)));
  console.log(`Biểu tượng: ${files.length} (cần tải ${todo.length})`);

  if (!dry && todo.length) {
    mkdirSync(ICON_DIR, { recursive: true });
    const urlByTitle = new Map();
    for (let i = 0; i < todo.length; i += 50) {
      const chunk = todo.slice(i, i + 50);
      const url = `${API}?${new URLSearchParams({
        action: "query",
        format: "json",
        prop: "imageinfo",
        iiprop: "url",
        titles: chunk.map((f) => `File:${f}`).join("|"),
      })}`;
      const q = (await (await fetch(url, { headers: { "User-Agent": UA } })).json()).query ?? {};
      // Tên trang trả về có thể được chuẩn hoá (dấu cách ↔ gạch dưới): ánh xạ ngược về tên ta hỏi.
      const alias = new Map(chunk.map((f) => [`File:${f}`.replace(/_/g, " "), f]));
      for (const n of q.normalized ?? []) alias.set(n.to.replace(/_/g, " "), alias.get(n.from.replace(/_/g, " ")) ?? n.from.replace(/^File:/, ""));
      for (const page of Object.values(q.pages ?? {})) {
        const u = page.imageinfo?.[0]?.url;
        const orig = alias.get(page.title.replace(/_/g, " "));
        if (u && orig) urlByTitle.set(orig, u);
      }
      await sleep(300);
    }
    let ok = 0;
    for (const f of todo) {
      const u = urlByTitle.get(f);
      if (!u) {
        console.warn(`  ! không có ảnh: ${f}`);
        continue;
      }
      try {
        const res = await fetch(u, { headers: { "User-Agent": UA } });
        if (!res.ok) throw new Error(String(res.status));
        const buf = Buffer.from(await res.arrayBuffer());
        await sharp(buf).resize(96, 96, { fit: "inside" }).webp({ quality: 92, alphaQuality: 100 }).toFile(join(ICON_DIR, `${slugOf(f)}.webp`));
        ok++;
      } catch (e) {
        console.warn(`  ! tải lỗi ${f}: ${e.message}`);
      }
      await sleep(120);
    }
    console.log(`Đã tải ${ok}/${todo.length} biểu tượng`);
  }

}

// Gắn đường dẫn icon (chỉ khi file tồn tại; --no-icons vẫn dùng các icon đã tải trước đó), rồi bỏ tên file wiki.
for (const r of Object.values(result))
  for (const s of r.list) {
    const slug = s.iconFile ? slugOf(s.iconFile) : "";
    if (slug && existsSync(join(ICON_DIR, `${slug}.webp`))) s.icon = `${ICON_URL}/${slug}.webp`;
    delete s.iconFile;
  }

// ───────── 3. ghi ─────────
if (dry) {
  console.log("[dry-run] không ghi file.");
} else {
  // Chạy với --only thì gộp vào dữ liệu có sẵn thay vì ghi đè toàn bộ.
  const prev = only && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  writeFileSync(OUT, JSON.stringify({ ...prev, ...result }, null, 1) + "\n");
  console.log(`Đã ghi ${OUT}`);
}
