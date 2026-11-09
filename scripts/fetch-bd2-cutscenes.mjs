#!/usr/bin/env node
/**
 * Lấy cutscene kỹ năng của Brown Dust 2 (cảnh cắt vào khi nhân vật tung chiêu) để dùng LOCAL, rồi gắn vào data/bd2.local.json.
 *  - Mô hình cutscene (Spine 4.1): Zormolo/Brown-Dust-2-Assets, assets/spine/skill_cutscene/<Nhân vật>/<Trang phục>/cutscene_charNNNNNN.*
 *    Mỗi cutscene là chuỗi animation `A_cut` → `B_cut_idle` → `C_cut_idle` → `loop`.
 *  - Nền: assets/ui/skill_cutscene_background/charNNNNNN backN.png. Mô hình KHÔNG có nền kèm theo; mỗi cảnh có vài ảnh nền lớn
 *    (back1, back2, back3 ≈ giai đoạn A, B, C) và nhiều sprite hiệu ứng nhỏ (back2-1, back2-2...) mà ta bỏ qua.
 * Asset thuộc Neowiz / Neon Eyes: chỉ dùng local (public/assets/ và data/*.local.json đã nằm trong .gitignore).
 *
 *   node scripts/fetch-bd2-cutscenes.mjs --dry-run            # xem có bao nhiêu cutscene / dung lượng, không tải
 *   node scripts/fetch-bd2-cutscenes.mjs                      # tải toàn bộ (≈1.5GB + nền), ghi vào data/bd2.local.json
 *   node scripts/fetch-bd2-cutscenes.mjs --only anastasia,blade
 *
 * Cần chạy scripts/fetch-bd2.mjs trước (để có data/bd2.local.json). Chạy lại an toàn: file đã tải thì bỏ qua.
 * Sau đó nên nén texture: node scripts/optimize-textures.mjs --all --game bd2 --quality 95
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data", "bd2.local.json");
const ASSET_DIR = join(ROOT, "public", "assets", "bd2");
const UA = "interactive-anime-local-fetch (personal fan project)";
const REPO = "Zormolo/Brown-Dust-2-Assets";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const dry = flag("dry-run");
const only = opt("only") ? new Set(opt("only").split(",").map((s) => slugify(s))) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(s) {
  return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

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
async function treeOf(parent, name) {
  const dir = await getJson(`https://api.github.com/repos/${REPO}/contents/${parent}`);
  const sha = dir.find((e) => e.name === name)?.sha;
  if (!sha) throw new Error(`không thấy ${parent}/${name}`);
  const tree = await getJson(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`);
  if (tree.truncated) console.warn(`! danh sách ${name} bị cắt bớt`);
  return tree.tree.filter((e) => e.type === "blob");
}
console.log("Đọc danh sách cutscene và nền...");
const cutFiles = await treeOf("assets/spine", "skill_cutscene");
const bgFiles = await treeOf("assets/ui", "skill_cutscene_background");

// "Nhân vật/Trang phục" → { files: Map(name → size), skel }
const byDir = new Map();
for (const e of cutFiles) {
  const parts = e.path.split("/");
  if (parts.length !== 3) continue;
  const key = `${slugify(parts[0])}/${slugify(parts[1])}`;
  if (!byDir.has(key)) byDir.set(key, { dir: `${parts[0]}/${parts[1]}`, files: new Map() });
  byDir.get(key).files.set(parts[2], e.size ?? 0);
}

/**
 * Ảnh nền của một cutscene. `mains`: nền chính back1, back2... (không có chỉ số phụ), ứng với từng pha.
 * `fx`: ảnh có chỉ số phụ (back2-1, back2-2...) là các KHUNG HÌNH HIỆU ỨNG (đạn găm, mảnh vụn...) cùng hệ toạ độ với nền chính
 * back2; phát tuần tự phủ lên nền đó. Chỉ giữ khung nào có cùng kích thước với nền (kiểm tra sau khi tải).
 */
function backgroundsOf(id) {
  const mains = [];
  const fx = [];
  for (const e of bgFiles) {
    const name = e.path.split("/").pop();
    if (!name.toLowerCase().includes(`char${id}`)) continue;
    const m = /back[_-]?(\d+)(?:[-_ ](\d+))?\.png$/i.exec(name);
    if (!m) continue;
    const item = { index: Number(m[1]), path: e.path, size: e.size ?? 0 };
    if (m[2] === undefined) mains.push(item);
    else fx.push({ ...item, sub: Number(m[2]) });
  }
  mains.sort((a, b) => a.index - b.index);
  fx.sort((a, b) => a.index - b.index || a.sub - b.sub);
  return { mains, fx };
}

// ───────── 2. ghép với dữ liệu hiện có ─────────
const jobs = [];
for (const c of characters) {
  if (only && !only.has(c.slug)) continue;
  for (const s of c.skins) {
    const hit = byDir.get(`${c.slug}/${s.id}`);
    if (!hit) continue;
    const skels = [...hit.files.keys()].filter((f) => /^cutscene_char\d+\.skel$/.test(f));
    const skel = skels[0];
    const base = skel?.replace(/\.skel$/, "");
    if (!skel || !hit.files.has(`${base}.atlas`)) continue;
    const id = /char(\d+)/.exec(base)[1];
    const { mains, fx } = backgroundsOf(id);
    jobs.push({ c, s, hit, skel, base, id, backgrounds: mains, fx: fx.filter((f) => mains.some((m) => m.index === f.index)) });
  }
}
const sizeOf = (j) => [...j.hit.files].filter(([f]) => f.startsWith(j.base) || f.endsWith(".png")).reduce((n, [, v]) => n + v, 0);
const totalMB = jobs.reduce((n, j) => n + sizeOf(j), 0) / 1e6;
const bgMB = jobs.reduce((n, j) => n + [...j.backgrounds, ...j.fx].reduce((m, b) => m + b.size, 0), 0) / 1e6;
console.log(`${jobs.length} cutscene (${new Set(jobs.map((j) => j.c.slug)).size} nhân vật), ≈${totalMB.toFixed(0)} MB mô hình + ${bgMB.toFixed(0)} MB nền`);
console.log(`Có nền: ${jobs.filter((j) => j.backgrounds.length).length}/${jobs.length}`);
if (dry) process.exit(0);

// ───────── 3. tải ─────────
const rawUrl = (path) => `https://raw.githubusercontent.com/${REPO}/main/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
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
  if (done % 100 === 0) console.log(`  ${done}`);
};

const dirOf = (j) => join(ASSET_DIR, j.c.slug, j.s.id, "cutscene");
for (const j of jobs) mkdirSync(dirOf(j), { recursive: true });

console.log(`Tải skeleton/atlas của ${jobs.length} cutscene...`);
await pool(jobs, async (j) => {
  for (const f of [j.skel, `${j.base}.atlas`]) await track(`${j.c.slug}/${j.s.id}/${f}`, download(rawUrl(`spine/skill_cutscene/${j.hit.dir}/${f}`), join(dirOf(j), f), j.hit.files.get(f)));
});
const pageJobs = [];
for (const j of jobs) {
  const atlas = join(dirOf(j), `${j.base}.atlas`);
  j.pages = existsSync(atlas) ? atlasPages(atlas) : [];
  for (const p of j.pages) pageJobs.push({ j, p });
}
console.log(`Tải ${pageJobs.length} trang texture...`);
await pool(pageJobs, ({ j, p }) => track(`${j.c.slug}/${j.s.id}/${p}`, download(rawUrl(`spine/skill_cutscene/${j.hit.dir}/${p}`), join(dirOf(j), p), j.hit.files.get(p))));

// Nền: tải PNG tạm rồi nén thành WebP (nền là ảnh phong cảnh nên nén khá nhiều mà vẫn đẹp), xoá PNG.
const bgJobs = [];
for (const j of jobs) for (const b of j.backgrounds) bgJobs.push({ j, b });
if (!flag("no-bg")) {
  console.log(`Tải ${bgJobs.length} ảnh nền...`);
  await pool(bgJobs, async ({ j, b }) => {
    const out = join(dirOf(j), `bg${b.index}.webp`);
    if (existsSync(out)) return;
    const tmp = join(dirOf(j), `bg${b.index}.png.tmp`);
    const r = await download(rawUrl(`ui/skill_cutscene_background/${b.path}`), tmp);
    if (r !== "ok" && r !== "skip") return void console.warn(`  ! nền ${j.c.slug}/${j.s.id} back${b.index}: ${r}`);
    await sharp(tmp).webp({ quality: 88, alphaQuality: 100 }).toFile(out);
    (await import("node:fs")).rmSync(tmp, { force: true });
  });

  // Khung hình hiệu ứng (giữ alpha): chỉ nhận khung có cùng kích thước với nền chính cùng chỉ số.
  const fxJobs = [];
  for (const j of jobs) for (const f of j.fx) fxJobs.push({ j, f });
  console.log(`Tải ${fxJobs.length} khung hình hiệu ứng...`);
  await pool(fxJobs, async ({ j, f }) => {
    const out = join(dirOf(j), `fx${f.index}_${f.sub}.webp`);
    if (existsSync(out)) return;
    const tmp = join(dirOf(j), `fx${f.index}_${f.sub}.png.tmp`);
    const r = await download(rawUrl(`ui/skill_cutscene_background/${f.path}`), tmp);
    if (r !== "ok" && r !== "skip") return;
    const fs = await import("node:fs");
    try {
      const bg = join(dirOf(j), `bg${f.index}.webp`);
      const [a, b] = await Promise.all([sharp(tmp).metadata(), existsSync(bg) ? sharp(bg).metadata() : null]);
      if (b && a.width === b.width && a.height === b.height) await sharp(tmp).webp({ quality: 90, alphaQuality: 100 }).toFile(out);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
}
console.log(`Xong tải: ${done} file, ${failed} lỗi.`);

// ───────── 4. ghi dữ liệu ─────────
let linked = 0;
for (const j of jobs) {
  const dir = dirOf(j);
  const atlas = join(dir, `${j.base}.atlas`);
  if (!existsSync(join(dir, j.skel)) || !existsSync(atlas) || !j.pages.length || !j.pages.every((p) => existsSync(join(dir, p)))) continue;
  const base = `/assets/bd2/${j.c.slug}/${j.s.id}/cutscene`;
  const present = j.backgrounds.filter((b) => existsSync(join(dir, `bg${b.index}.webp`)));
  const backgrounds = present.map((b) => `${base}/bg${b.index}.webp`);
  const effects = present.map((b) =>
    j.fx
      .filter((f) => f.index === b.index && existsSync(join(dir, `fx${f.index}_${f.sub}.webp`)))
      .map((f) => `${base}/fx${f.index}_${f.sub}.webp`),
  );
  // Giữ liên kết tới atlas WebP nếu optimize-textures đã chuyển (chạy lại script này không được đưa về PNG).
  const webpAtlas = join(dir, `${j.base}.webp.atlas`);
  j.s.cutscene = {
    kind: "spine",
    skel: `${base}/${j.skel}`,
    atlas: `${base}/${j.base}${existsSync(webpAtlas) ? ".webp.atlas" : ".atlas"}`,
    version: spineVersion(join(dir, j.skel)),
    backgrounds,
    ...(effects.some((e) => e.length) ? { effects } : {}),
  };
  linked++;
}
writeFileSync(DATA, JSON.stringify(characters, null, 2) + "\n");
console.log(`Đã gắn cutscene cho ${linked} trang phục vào ${DATA}.`);
