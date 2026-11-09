#!/usr/bin/env node
/**
 * Lấy "Fated Guest" của Brown Dust 2 (tranh động toàn màn hình của cảnh hẹn hò) để dùng LOCAL, rồi gắn vào data/bd2.local.json.
 *  - Nguồn: Zormolo/Brown-Dust-2-Assets, assets/spine/interaction/<Nhân vật>/<Trang phục>/illust_datingN.* (Spine 4.1).
 *    Mô hình có `idle1`, `idle2` và nhiều `mixN_k` (phản ứng khi chạm vào một chỗ), mỗi tranh nặng ≈ 25–40 MB (10–15 trang texture).
 * Asset thuộc Neowiz / Neon Eyes: chỉ dùng local (public/assets/ và data/*.local.json đã nằm trong .gitignore).
 *
 *   node scripts/fetch-bd2-dating.mjs --dry-run            # xem có bao nhiêu tranh / dung lượng, không tải
 *   node scripts/fetch-bd2-dating.mjs                      # tải toàn bộ, ghi vào data/bd2.local.json
 *   node scripts/fetch-bd2-dating.mjs --only dalvi,yuri
 *   (angelica/neon-savior bị bỏ qua vì dùng định dạng mới chưa dựng được; thêm --include-unsupported để thử)
 *
 * Cần chạy scripts/fetch-bd2.mjs trước. Chạy lại an toàn: file đã tải thì bỏ qua.
 * Sau đó nén texture: node scripts/optimize-textures.mjs --all --game bd2 --quality 95
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data", "bd2.local.json");
const ASSET_DIR = join(ROOT, "public", "assets", "bd2");
const UA = "interactive-anime-local-fetch (personal fan project)";
const REPO = "Zormolo/Brown-Dust-2-Assets";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const dry = flag("dry-run");
const slugify = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Định dạng mới mà renderer (và viewer cộng đồng) chưa dựng đúng: skeleton chỉ ra mảng đen. Dùng --include-unsupported để thử.
const UNSUPPORTED = new Set(["angelica/neon-savior"]);
const only = opt("only") ? new Set(opt("only").split(",").map(slugify)) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i === tries) throw e;
      await sleep(800 * i);
    }
  }
}

if (!existsSync(DATA)) {
  console.error("Chưa có data/bd2.local.json: chạy scripts/fetch-bd2.mjs trước.");
  process.exit(1);
}
const characters = JSON.parse(readFileSync(DATA, "utf8"));

// ───────── 1. danh sách file ─────────
console.log("Đọc danh sách Fated Guest...");
const spineDir = await getJson(`https://api.github.com/repos/${REPO}/contents/assets/spine`);
const sha = spineDir.find((e) => e.name === "interaction")?.sha;
if (!sha) throw new Error("không thấy assets/spine/interaction");
const tree = await getJson(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`);
if (tree.truncated) console.warn("! danh sách bị cắt bớt");

// "Nhân vật/Trang phục" → { dir, files: Map(name → size) }
const byDir = new Map();
for (const e of tree.tree) {
  if (e.type !== "blob") continue;
  const parts = e.path.split("/");
  if (parts.length !== 3) continue;
  const key = `${slugify(parts[0])}/${slugify(parts[1])}`;
  if (!byDir.has(key)) byDir.set(key, { dir: `${parts[0]}/${parts[1]}`, files: new Map() });
  byDir.get(key).files.set(parts[2], e.size ?? 0);
}

// ───────── 2. ghép với dữ liệu hiện có ─────────
const jobs = [];
const unmatched = new Set(byDir.keys());
for (const c of characters) {
  if (only && !only.has(c.slug)) continue;
  for (const s of c.skins) {
    const key = `${c.slug}/${s.id}`;
    const hit = byDir.get(key);
    if (!hit) continue;
    unmatched.delete(key);
    if (UNSUPPORTED.has(key) && !flag("include-unsupported")) {
      console.warn(`! Bỏ qua ${key} (định dạng chưa được hỗ trợ; --include-unsupported để thử)`);
      continue;
    }
    const skel = [...hit.files.keys()].find((f) => /^illust_dating\d+\.skel$/.test(f));
    const base = skel?.replace(/\.skel$/, "");
    if (!skel || !hit.files.has(`${base}.atlas`)) continue;
    jobs.push({ c, s, hit, skel, base });
  }
}
if (unmatched.size && !only) console.warn(`! Không ghép được với trang phục nào: ${[...unmatched].join(", ")}`);
const sizeOf = (j) => [...j.hit.files].filter(([f]) => f.startsWith(j.base)).reduce((n, [, v]) => n + v, 0);
console.log(`${jobs.length} tranh Fated Guest (${new Set(jobs.map((j) => j.c.slug)).size} nhân vật), ≈${(jobs.reduce((n, j) => n + sizeOf(j), 0) / 1e6).toFixed(0)} MB`);
if (dry) process.exit(0);

// ───────── 3. tải ─────────
const rawUrl = (path) => `https://raw.githubusercontent.com/${REPO}/main/assets/spine/interaction/${path.split("/").map(encodeURIComponent).join("/")}`;
async function download(url, dest, expected) {
  if (existsSync(dest) && (!expected || statSync(dest).size === expected)) return "skip";
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(String(res.status));
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return "ok";
    } catch (e) {
      if (i === 3) return `lỗi (${e.message})`;
      await sleep(600 * i);
    }
  }
}
const atlasPages = (file) =>
  [...readFileSync(file, "utf8").replace(/^﻿/, "").matchAll(/^([^\s:][^\r\n]*\.png)[ \t]*\r?\n[ \t]*size:/gm)].map((m) => m[1]);
const spineVersion = (file) => /(\d\.\d)\.\d+/.exec(readFileSync(file).subarray(0, 64).toString("latin1"))?.[1] ?? "4.1";

let done = 0;
let failed = 0;
async function pool(items, worker, size = 6) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let it = queue.shift(); it; it = queue.shift()) await worker(it);
    }),
  );
}
const track = async (label, p) => {
  const r = await p;
  done++;
  if (r !== "ok" && r !== "skip") {
    failed++;
    console.warn(`  ! ${label}: ${r}`);
  }
  if (done % 50 === 0) console.log(`  ${done}`);
};

const dirOf = (j) => join(ASSET_DIR, j.c.slug, j.s.id, "dating");
for (const j of jobs) mkdirSync(dirOf(j), { recursive: true });

console.log(`Tải skeleton/atlas của ${jobs.length} tranh...`);
await pool(jobs, async (j) => {
  for (const f of [j.skel, `${j.base}.atlas`]) await track(`${j.c.slug}/${j.s.id}/${f}`, download(rawUrl(`${j.hit.dir}/${f}`), join(dirOf(j), f), j.hit.files.get(f)));
});
const pageJobs = [];
for (const j of jobs) {
  const atlas = join(dirOf(j), `${j.base}.atlas`);
  j.pages = existsSync(atlas) ? atlasPages(atlas) : [];
  for (const p of j.pages) pageJobs.push({ j, p });
}
console.log(`Tải ${pageJobs.length} trang texture...`);
await pool(pageJobs, ({ j, p }) => track(`${j.c.slug}/${j.s.id}/${p}`, download(rawUrl(`${j.hit.dir}/${p}`), join(dirOf(j), p), j.hit.files.get(p))));
console.log(`Xong tải: ${done} file, ${failed} lỗi.`);

// ───────── 4. ghi dữ liệu ─────────
let linked = 0;
for (const j of jobs) {
  const dir = dirOf(j);
  const atlas = join(dir, `${j.base}.atlas`);
  if (!existsSync(join(dir, j.skel)) || !existsSync(atlas) || !j.pages.length || !j.pages.every((p) => existsSync(join(dir, p)))) continue;
  const base = `/assets/bd2/${j.c.slug}/${j.s.id}/dating`;
  // Giữ liên kết tới atlas WebP nếu optimize-textures đã chuyển (chạy lại script này không được đưa về PNG).
  const webpAtlas = join(dir, `${j.base}.webp.atlas`);
  j.s.dating = {
    kind: "spine",
    skel: `${base}/${j.skel}`,
    atlas: `${base}/${j.base}${existsSync(webpAtlas) ? ".webp.atlas" : ".atlas"}`,
    version: spineVersion(join(dir, j.skel)),
  };
  linked++;
}
writeFileSync(DATA, JSON.stringify(characters, null, 2) + "\n");
console.log(`Đã gắn Fated Guest cho ${linked} trang phục vào ${DATA}.`);
