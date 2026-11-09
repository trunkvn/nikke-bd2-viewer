#!/usr/bin/env node
/**
 * Lấy mô hình Spine của Brown Dust 2 từ kho asset cộng đồng để dùng LOCAL (không commit/deploy):
 *  - Mô hình + trang phục: github.com/Zormolo/Brown-Dust-2-Assets (assets/spine/character/<Nhân vật>/<Trang phục>/charNNNNNN.*)
 *  - Hạng sao + ngày ra mắt: github.com/myssal/Brown-Dust-2-Asset (CharInfo(Dropped).json, có thể thiếu nhân vật mới)
 * Asset game thuộc Neowiz / Neon Eyes. Thư mục public/assets/ và data/*.local.json đã nằm trong .gitignore.
 *
 *   node scripts/fetch-bd2.mjs --list              # liệt kê nhân vật/trang phục, không tải
 *   node scripts/fetch-bd2.mjs                     # tải toàn bộ (≈0.5 GB), ghi data/bd2.local.json, render thumbnail
 *   node scripts/fetch-bd2.mjs --only blade,eris   # chỉ vài nhân vật (slug hoặc tên thư mục)
 *   node scripts/fetch-bd2.mjs --no-posters        # bỏ qua bước render thumbnail
 *
 * Chạy lại an toàn: file đã tải thì bỏ qua. Kết quả: public/assets/bd2/<nhân-vật>/<trang-phục>/{.skel,.atlas,.png}.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPosters } from "./render-posters.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = join(ROOT, "data", "bd2.local.json");
const ASSET_DIR = join(ROOT, "public", "assets", "bd2");
const UA = "interactive-anime-local-fetch (personal fan project)";
const ASSET_REPO = "Zormolo/Brown-Dust-2-Assets";
const ASSET_ROOT = "assets/spine/character";
const INFO_URL = "https://raw.githubusercontent.com/myssal/Brown-Dust-2-Asset/master/CharInfo(Dropped).json";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const only = opt("only") ? new Set(opt("only").split(",").map((s) => slugify(s))) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
const prettify = (folder) => folder.replace(/_/g, " ");

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

// ───────── 1. danh sách file trong kho asset ─────────
console.log("Đọc danh sách asset...");
const spineDir = await getJson(`https://api.github.com/repos/${ASSET_REPO}/contents/${ASSET_ROOT.split("/").slice(0, 2).join("/")}`);
const charSha = spineDir.find((e) => e.name === "character")?.sha;
if (!charSha) throw new Error("không thấy thư mục assets/spine/character");
const tree = await getJson(`https://api.github.com/repos/${ASSET_REPO}/git/trees/${charSha}?recursive=1`);
if (tree.truncated) console.warn("! Danh sách file bị cắt bớt, có thể thiếu nhân vật");

// path: "Blade/Apostle/char003701.skel" → nhóm theo thư mục trang phục
const costumes = new Map(); // "Blade/Apostle" → { char, costume, files: Map(name → size) }
for (const e of tree.tree) {
  if (e.type !== "blob") continue;
  const parts = e.path.split("/");
  if (parts.length !== 3) continue;
  const key = `${parts[0]}/${parts[1]}`;
  if (!costumes.has(key)) costumes.set(key, { char: parts[0], costume: parts[1], files: new Map() });
  costumes.get(key).files.set(parts[2], e.size ?? 0);
}

// ───────── 2. hạng sao + ngày ra mắt ─────────
let info = [];
try {
  // File gốc đôi khi thiếu dấu phẩy giữa hai thuộc tính: vá lại trước khi parse.
  const raw = await (await fetch(INFO_URL, { headers: { "User-Agent": UA } })).text();
  info = JSON.parse(raw.replace(/("censored_spine":\s*"[^"]*")\s*\n(\s*")/g, "$1,\n$2"));
} catch (e) {
  console.warn(`! Không đọc được CharInfo (${e.message}); bỏ qua hạng sao và ngày ra mắt.`);
}
const infoByChar = new Map(info.map((c) => [c.charId, c]));
const infoBySpine = new Map();
for (const c of info) for (const k of c.costumes ?? []) infoBySpine.set(k.spine, k);

// ───────── 3. dựng dữ liệu ─────────
/** Skeleton chính của một trang phục: bỏ bản kiểm duyệt "_c", ưu tiên charNNNNNN.skel. */
function pickSkeleton(files) {
  const skels = [...files.keys()].filter((f) => f.endsWith(".skel"));
  return skels.find((f) => /^char\d+\.skel$/.test(f)) ?? skels.find((f) => !/_c\.skel$/.test(f)) ?? skels[0];
}

const byChar = new Map();
for (const c of [...costumes.values()].sort((a, b) => `${a.char}/${a.costume}`.localeCompare(`${b.char}/${b.costume}`))) {
  const slug = slugify(c.char);
  if (only && !only.has(slug)) continue;
  const skel = pickSkeleton(c.files);
  const base = skel?.replace(/\.skel$/, "");
  if (!skel || !c.files.has(`${base}.atlas`)) {
    console.warn(`bỏ qua ${c.char}/${c.costume}: thiếu .skel/.atlas`);
    continue;
  }
  const digits = /^char(\d+)$/.exec(base)?.[1];
  const charId = digits ? digits.slice(0, 4) : undefined;
  if (!byChar.has(slug)) byChar.set(slug, { slug, folder: c.char, charId, costumes: [] });
  byChar.get(slug).costumes.push({ ...c, skel, base, costumeSlug: slugify(c.costume), meta: infoBySpine.get(base) });
}

if (flag("list")) {
  for (const ch of byChar.values()) {
    const meta = infoByChar.get(ch.charId);
    console.log(`${ch.slug.padEnd(22)} ★${meta?.rarity ?? "?"}  ${ch.costumes.map((k) => k.costume).join(", ")}`);
  }
  console.log(`\n${byChar.size} nhân vật, ${[...byChar.values()].reduce((n, c) => n + c.costumes.length, 0)} trang phục`);
  process.exit(0);
}

// ───────── 4. tải file ─────────
const rawUrl = (path) =>
  `https://raw.githubusercontent.com/${ASSET_REPO}/main/${ASSET_ROOT}/${path.split("/").map(encodeURIComponent).join("/")}`;

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

/** Phiên bản Spine từ header .skel: chuỗi "4.1.11" nằm ngay sau hash. */
function spineVersion(file) {
  const head = readFileSync(file).subarray(0, 64).toString("latin1");
  return /(\d\.\d)\.\d+/.exec(head)?.[1];
}

/** Các trang texture mà atlas tham chiếu (dòng không thụt đầu, kết thúc ".png"; một atlas có thể có nhiều trang). */
function atlasPages(file) {
  return [...readFileSync(file, "utf8").replace(/^\uFEFF/, "").matchAll(/^([^\s:][^\r\n]*\.png)[ \t]*\r?\n[ \t]*size:/gm)].map((m) => m[1]);
}

let done = 0;
let failed = 0;
let skipped = 0;
async function runJobs(jobs) {
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const r = await download(j.url, j.dest, j.size);
        done++;
        if (r === "skip") skipped++;
        else if (r !== "ok") {
          failed++;
          console.warn(`  ! ${j.label}: ${r}`);
        }
        if (done % 100 === 0) console.log(`  ${done}`);
      }
    }),
  );
}
const jobFor = (ch, k, f) => ({
  url: rawUrl(`${k.char}/${k.costume}/${f}`),
  dest: join(ASSET_DIR, ch.slug, k.costumeSlug, f),
  size: k.files.get(f),
  label: `${ch.slug}/${k.costumeSlug}/${f}`,
});

// Bước 1: skeleton + atlas. Bước 2: các trang texture đọc từ atlas.
const stage1 = [];
for (const ch of byChar.values())
  for (const k of ch.costumes) {
    mkdirSync(join(ASSET_DIR, ch.slug, k.costumeSlug), { recursive: true });
    for (const f of [k.skel, `${k.base}.atlas`]) stage1.push(jobFor(ch, k, f));
  }
console.log(`Tải ${stage1.length} file skeleton/atlas (${byChar.size} nhân vật)...`);
await runJobs(stage1);

const stage2 = [];
for (const ch of byChar.values())
  for (const k of ch.costumes) {
    const atlasFile = join(ASSET_DIR, ch.slug, k.costumeSlug, `${k.base}.atlas`);
    if (!existsSync(atlasFile)) continue;
    k.pages = atlasPages(atlasFile);
    for (const page of k.pages) stage2.push(jobFor(ch, k, page));
  }
console.log(`Tải ${stage2.length} trang texture...`);
await runJobs(stage2);
console.log(`Xong tải: ${done - skipped - failed} mới, ${skipped} đã có, ${failed} lỗi.`);

// ───────── 5. ghi dữ liệu ─────────
const characters = [];
const posterItems = [];
for (const ch of byChar.values()) {
  const meta = infoByChar.get(ch.charId);
  const skins = [];
  for (const k of ch.costumes) {
    const dir = join(ASSET_DIR, ch.slug, k.costumeSlug);
    if (![k.skel, `${k.base}.atlas`, ...(k.pages ?? [])].every((f) => existsSync(join(dir, f))) || !k.pages?.length) continue;
    const base = `/assets/bd2/${ch.slug}/${k.costumeSlug}`;
    const version = spineVersion(join(dir, k.skel)) ?? "4.1";
    const render = { kind: "spine", skel: `${base}/${k.skel}`, atlas: `${base}/${k.base}.atlas`, version };
    skins.push({
      id: k.costumeSlug,
      name: prettify(k.costume),
      thumb: `${base}/thumb.webp`,
      render,
      ...(k.meta?.releaseDate ? { released: k.meta.releaseDate } : {}),
    });
    posterItems.push({ dir, skinId: `${ch.slug}/${k.costumeSlug}`, version, skel: render.skel, atlas: render.atlas });
  }
  if (!skins.length) continue;
  characters.push({
    id: `bd2-${ch.slug}`,
    slug: ch.slug,
    game: "bd2",
    name: prettify(ch.folder),
    ...(meta?.rarity > 0 ? { stars: meta.rarity } : {}),
    tags: [],
    description: "",
    skins,
  });
}
characters.sort((a, b) => a.name.localeCompare(b.name));

// Chạy với --only thì gộp vào dữ liệu có sẵn thay vì ghi đè.
let out = characters;
if (only && existsSync(OUT_JSON)) {
  const prev = JSON.parse(readFileSync(OUT_JSON, "utf8")).filter((c) => !characters.some((n) => n.id === c.id));
  out = [...prev, ...characters].sort((a, b) => a.name.localeCompare(b.name));
}
mkdirSync(dirname(OUT_JSON), { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + "\n");
console.log(`Đã ghi ${OUT_JSON}: ${out.length} nhân vật, ${out.reduce((n, c) => n + c.skins.length, 0)} trang phục.`);

// ───────── 6. thumbnail ─────────
if (!flag("no-posters")) {
  console.log(`Render thumbnail cho ${posterItems.length} trang phục...`);
  await renderPosters(posterItems, { mode: "portrait" });
}
