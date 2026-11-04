#!/usr/bin/env node
/**
 * Tải asset Spine + metadata nhân vật Nikke từ repo cộng đồng Nikke-db để dùng LOCAL.
 * Asset thuộc bản quyền Shift Up/Level Infinite: KHÔNG commit, KHÔNG deploy công khai.
 *
 *   node scripts/fetch-nikke.mjs --list                 # danh sách nhân vật có thể tải (id, tên, số skin, MB)
 *   node scripts/fetch-nikke.mjs --all --dry-run        # xem sẽ tải gì, bao nhiêu MB (chưa tải)
 *   node scripts/fetch-nikke.mjs --all                  # tải toàn bộ (khoảng 2GB), có thể ngắt rồi chạy lại để tiếp tục
 *   node scripts/fetch-nikke.mjs c010 c011              # chỉ vài nhân vật theo id
 *
 * Mỗi skin còn có hai tư thế chiến đấu: l2d/<skin>/aim/ (ngắm bắn) và l2d/<skin>/cover/ (nấp), là các skeleton
 * Spine riêng. Mặc định tải cả hai (thêm khoảng 2.2GB cho toàn bộ); dùng --no-poses để bỏ qua.
 *
 * Tuỳ chọn: --no-poses · --no-posters (bỏ render thumbnail, cần Chrome) · --include-unmatched (giữ cả nhân vật
 * không tra được trên wiki) · GITHUB_TOKEN (nếu bị giới hạn rate limit của GitHub API).
 *
 * Nguồn:
 *  - Danh sách skin + tên: Nikke-db/nikke-db-vue (l2d.json) và bộ lọc NPC/sự kiện (filteredCharacterIds.json).
 *  - File Spine: Nikke-db/Nikke-db.github.io (thư mục l2d/<id>/).
 *  - Metadata + ngày phát hành: wiki NIKKE (infobox). Không tra được trên wiki và cũng không có trong
 *    bảng cũ Characters.json thì coi là chưa phát hành/không chơi được và bỏ qua.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWikiMetaSmart } from "./lib/wiki-meta.mjs";
import { renderPosters } from "./render-posters.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_REPO = "Nikke-db/Nikke-db.github.io";
const VUE_REPO = "Nikke-db/nikke-db-vue";
const RAW = `https://raw.githubusercontent.com/${ASSET_REPO}/main`;
const RAW_VUE = `https://raw.githubusercontent.com/${VUE_REPO}/main/src/utils/json`;
const LOCAL_JSON = join(ROOT, "data", "nikke.local.json");
const CONCURRENCY = 8;

const headers = { "User-Agent": "interactive-anime-local-fetch" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const ids = argv.filter((a) => !a.startsWith("--"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (bytes) => (bytes / 1e6).toFixed(0);

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** Chạy fn cho từng phần tử với tối đa n tác vụ song song. */
async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

/** Tải về, ghi vào file .part rồi mới đổi tên: file dở dang không bao giờ bị coi là đã tải xong. */
async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) return true;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(String(res.status));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(`${dest}.part`, Buffer.from(await res.arrayBuffer()));
      renameSync(`${dest}.part`, dest);
      return true;
    } catch {
      await sleep(600 * attempt);
    }
  }
  return false;
}

/** Version Spine nằm trong header .skel: 8 byte hash, rồi chuỗi (độ dài+1 là byte đầu). */
function skelVersion(path) {
  const buf = readFileSync(path);
  const len = buf[8] - 1;
  const v = buf.subarray(9, 9 + len).toString("ascii");
  const m = /^(\d+)\.(\d+)/.exec(v);
  return m ? `${m[1]}.${m[2]}` : null;
}

const titleCase = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const stripHtml = (s) => s.replace(/<[^>]*>/g, "").trim();
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const upFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const thumbPath = (skinId) => join(ROOT, "public", "assets", "nikke", skinId, "thumb.webp");
const thumbUrl = (skinId) => `/assets/nikke/${skinId}/thumb.webp`;

// ───────────────────────── 1. Danh sách nhân vật ─────────────────────────
async function loadRoster() {
  const [l2d, filtered, legacy, tree] = await Promise.all([
    getJson(`${RAW_VUE}/l2d.json`),
    getJson(`${RAW_VUE}/filteredCharacterIds.json`),
    getJson(`${RAW}/js/json/Characters.json`),
    getJson(`https://api.github.com/repos/${ASSET_REPO}/git/trees/main?recursive=1`),
  ]);
  if (tree.truncated) throw new Error("Danh sách file của repo bị cắt bớt, không thể liệt kê đầy đủ.");

  const filesByDir = new Map();
  const poseFilesByDir = new Map(); // skin -> { aim: [...], cover: [...] }
  for (const e of tree.tree) {
    if (e.type !== "blob") continue;
    const m = /^l2d\/([^/]+)\/([^/]+)$/.exec(e.path); // file ngay trong thư mục skin (tư thế đứng)
    if (m) {
      if (!filesByDir.has(m[1])) filesByDir.set(m[1], []);
      filesByDir.get(m[1]).push({ name: m[2], size: e.size });
      continue;
    }
    const p = /^l2d\/([^/]+)\/(aim|cover)\/([^/]+)$/.exec(e.path); // tư thế ngắm / nấp
    if (p && !flag("no-poses")) {
      if (!poseFilesByDir.has(p[1])) poseFilesByDir.set(p[1], {});
      const kinds = poseFilesByDir.get(p[1]);
      (kinds[p[2]] ??= []).push({ name: p[3], size: e.size });
    }
  }

  const skip = new Set(filtered.filteredIds);
  const roster = new Map();
  const seen = new Set();
  for (const entry of l2d) {
    const cid = /^(c\d+)/.exec(entry.id)?.[1]; // chỉ nhân vật (c###); bỏ ảnh sự kiện
    const files = filesByDir.get(entry.id);
    if (!cid || skip.has(entry.id) || seen.has(entry.id) || !files?.some((f) => f.name.endsWith(".skel"))) continue;
    seen.add(entry.id);
    if (!roster.has(cid)) roster.set(cid, { id: cid, name: "", skins: [] });
    roster.get(cid).skins.push({ id: entry.id, name: entry.name, files, poseFiles: poseFilesByDir.get(entry.id) ?? {} });
  }
  for (const c of roster.values()) {
    c.skins.sort((a, b) => (a.id === c.id ? -1 : b.id === c.id ? 1 : a.id.localeCompare(b.id)));
    c.name = c.skins[0].name; // skin gốc (id = id nhân vật) đứng đầu; thiếu thì lấy skin đầu tiên
    const sum = (list) => list.reduce((m, f) => m + f.size, 0);
    c.bytes = c.skins.reduce((n, s) => n + sum(s.files) + Object.values(s.poseFiles).reduce((m, l) => m + sum(l), 0), 0);
  }
  return { roster, legacy: new Map(legacy.map((c) => [c.id, c])) };
}

const { roster, legacy } = await loadRoster();

if (flag("list")) {
  for (const c of roster.values()) console.log(`${c.id}\t${c.name}\t${c.skins.length} skin\t${mb(c.bytes)}MB`);
  console.log(`\n${roster.size} nhân vật, ${[...roster.values()].reduce((n, c) => n + c.skins.length, 0)} skin`);
  process.exit(0);
}

let selected;
if (flag("all")) selected = [...roster.values()];
else if (ids.length) {
  selected = [];
  for (const id of ids) {
    if (roster.has(id)) selected.push(roster.get(id));
    else console.error(`✗ ${id}: không có trong danh sách (xem --list)`);
  }
} else {
  console.error("Dùng: node scripts/fetch-nikke.mjs --all | <id> [<id>...] | --list   (thêm --dry-run để xem trước)");
  process.exit(1);
}

// ───────────────────────── 2. Metadata + lọc chưa phát hành ─────────────────────────
console.log(`Tra metadata trên wiki cho ${selected.length} nhân vật...`);
const wiki = await fetchWikiMetaSmart(selected.map((c) => c.name));

const included = [];
const excluded = { unreleased: [], unmatched: [] };
for (const c of selected) {
  const w = wiki.get(c.name);
  const old = legacy.get(c.id);
  if (w?.released === false) excluded.unreleased.push(c);
  else if (!w && !old && !flag("include-unmatched")) excluded.unmatched.push(c);
  else included.push({ ...c, w, old });
}

const total = included.reduce((n, c) => n + c.bytes, 0);
console.log(
  `→ ${included.length} nhân vật / ${included.reduce((n, c) => n + c.skins.length, 0)} skin / ${mb(total)}MB` +
    ` (bỏ ${excluded.unreleased.length} chưa phát hành, ${excluded.unmatched.length} không tra được trên wiki)`,
);
if (excluded.unreleased.length) console.log("  chưa phát hành:", excluded.unreleased.map((c) => c.name).join(", "));
if (excluded.unmatched.length) console.log("  không khớp wiki:", excluded.unmatched.map((c) => `${c.name} (${c.id})`).join(", "));
if (flag("dry-run")) process.exit(0);

// ───────────────────────── 3. Tải file ─────────────────────────
const jobs = included.flatMap((c) =>
  c.skins.flatMap((s) => [
    ...s.files.map((f) => ({ url: `${RAW}/l2d/${s.id}/${f.name}`, dest: join(ROOT, "public", "assets", "nikke", s.id, f.name) })),
    ...Object.entries(s.poseFiles).flatMap(([kind, files]) =>
      files.map((f) => ({
        url: `${RAW}/l2d/${s.id}/${kind}/${f.name}`,
        dest: join(ROOT, "public", "assets", "nikke", s.id, kind, f.name),
      })),
    ),
  ]),
);
let done = 0;
let failed = 0;
console.log(`Tải ${jobs.length} file (song song ${CONCURRENCY})...`);
await pool(jobs, CONCURRENCY, async (job) => {
  if (!(await download(job.url, job.dest))) {
    failed++;
    console.error(`  ! lỗi ${job.url.replace(RAW, "")}`);
  }
  if (++done % 50 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length}`);
});

// ───────────────────────── 4. Dựng dữ liệu ─────────────────────────
const out = existsSync(LOCAL_JSON) ? JSON.parse(readFileSync(LOCAL_JSON, "utf8")) : [];
const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
const usedSlugs = new Map(out.map((c) => [c.slug, c.id]));
const posterItems = [];

for (const c of included) {
  const skins = [];
  for (const s of c.skins) {
    const dir = join(ROOT, "public", "assets", "nikke", s.id);
    const skel = s.files.find((f) => f.name.endsWith(".skel"))?.name;
    const atlas = s.files.find((f) => f.name.endsWith(".atlas"))?.name;
    if (!skel || !atlas || !existsSync(join(dir, skel)) || !existsSync(join(dir, atlas))) {
      console.error(`  ! ${s.id}: thiếu file, bỏ qua skin`);
      continue;
    }
    const version = skelVersion(join(dir, skel));
    if (version !== "4.0" && version !== "4.1") {
      console.error(`  ! ${s.id}: Spine ${version} chưa được hỗ trợ, bỏ qua skin`);
      continue;
    }
    // Tư thế ngắm / nấp: mỗi tư thế là một skeleton riêng (có thể khác version Spine với tư thế đứng).
    const poses = {};
    for (const kind of ["aim", "cover"]) {
      const files = s.poseFiles?.[kind];
      if (!files) continue;
      const pSkel = files.find((f) => f.name.endsWith(".skel"))?.name;
      const pAtlas = files.find((f) => f.name.endsWith(".atlas"))?.name;
      const pDir = join(dir, kind);
      if (!pSkel || !pAtlas || !existsSync(join(pDir, pSkel)) || !existsSync(join(pDir, pAtlas))) continue;
      const pVersion = skelVersion(join(pDir, pSkel));
      if (pVersion !== "4.0" && pVersion !== "4.1") {
        console.error(`  ! ${s.id}/${kind}: Spine ${pVersion} chưa được hỗ trợ, bỏ qua tư thế`);
        continue;
      }
      poses[kind] = {
        kind: "spine",
        skel: `/assets/nikke/${s.id}/${kind}/${pSkel}`,
        atlas: `/assets/nikke/${s.id}/${kind}/${pAtlas}`,
        version: pVersion,
      };
    }
    const rest = s.name.replace(c.name, "").replace(/^[\s_:\-]+/, "").trim();
    const render = { kind: "spine", skel: `/assets/nikke/${s.id}/${skel}`, atlas: `/assets/nikke/${s.id}/${atlas}`, version };
    skins.push({
      id: s.id,
      name: s.id === c.id ? "Mặc định" : rest ? upFirst(rest) : s.id,
      thumb: existsSync(thumbPath(s.id)) ? thumbUrl(s.id) : "",
      render,
      ...(Object.keys(poses).length > 0 && { poses }),
    });
    posterItems.push({ skinId: s.id, version, skel: render.skel, atlas: render.atlas });
  }
  if (skins.length === 0) continue;

  const { w, old } = c;
  const meta = defined({
    rarity: w?.rarity ?? old?.rarity,
    class: w?.class ?? old?.class,
    element: w?.element ?? old?.weapon?.attack_type,
    manufacturer: w?.manufacturer ?? (old?.manufacturer ? titleCase(old.manufacturer) : undefined),
    weapon: w?.weapon ?? old?.weapon?.weapon_type,
    squad: w?.squad ?? old?.squad,
  });
  const idx = out.findIndex((x) => x.id === `nikke-${c.id}`);
  let slug = idx >= 0 ? out[idx].slug : slugify(c.name) || c.id;
  if (idx < 0 && usedSlugs.has(slug)) slug = `${slug}-${c.id}`;
  usedSlugs.set(slug, `nikke-${c.id}`);

  const character = {
    id: `nikke-${c.id}`,
    slug,
    game: "nikke",
    name: c.name,
    ...(meta.rarity && { rarity: meta.rarity }),
    ...(meta.class && { class: meta.class }),
    ...(meta.element && { element: meta.element }),
    ...(meta.manufacturer && { manufacturer: meta.manufacturer }),
    ...(meta.weapon && { weapon: meta.weapon }),
    tags: meta.squad ? [slugify(meta.squad)] : [],
    description: w?.description ?? (old?.description ? stripHtml(old.description) : ""),
    skins,
  };
  if (idx >= 0) out[idx] = character;
  else out.push(character);
}
mkdirSync(dirname(LOCAL_JSON), { recursive: true });
const save = () => writeFileSync(LOCAL_JSON, JSON.stringify(out, null, 2) + "\n");
save();
console.log(`✓ Đã ghi ${out.length} nhân vật vào data/nikke.local.json${failed ? ` (${failed} file tải lỗi, chạy lại để thử tiếp)` : ""}`);

// ───────────────────────── 5. Thumbnail ─────────────────────────
if (!flag("no-posters")) {
  console.log(`Render thumbnail cho ${posterItems.length} skin...`);
  const ok = await renderPosters(posterItems);
  for (const c of out) for (const s of c.skins) if (ok.has(s.id)) s.thumb = thumbUrl(s.id);
  save();
}
// Skin nào vẫn chưa có thumbnail thì dùng icon 128px của game làm phương án dự phòng.
const noThumb = out.flatMap((c) => c.skins.map((s) => ({ c, s }))).filter(({ s }) => !s.thumb);
if (noThumb.length) {
  await pool(noThumb, CONCURRENCY, async ({ c, s }) => {
    const dest = join(ROOT, "public", "assets", "nikke", s.id, "icon.png");
    const base = c.id.replace(/^nikke-/, "");
    const got =
      (await download(`${RAW}/images/sprite/si_${s.id}_00_s.png`, dest)) ||
      (await download(`${RAW}/images/sprite/si_${base}_00_s.png`, dest));
    if (got) s.thumb = `/assets/nikke/${s.id}/icon.png`;
  });
  save();
}
console.log("Xong.");
