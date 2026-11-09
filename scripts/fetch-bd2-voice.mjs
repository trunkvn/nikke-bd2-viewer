#!/usr/bin/env node
/**
 * Lấy giọng nói (câu "BattleReady", 3 câu mỗi trang phục, tiếng Nhật + tiếng Hàn) của Brown Dust 2 để dùng LOCAL.
 *  - Nguồn: jelosus2/BD2-L2D-Viewer, src/assets/audios/<charNNNNNN>/<JP|KR>/CharNNNNNN_BattleReady_N.webm (≈40 MB cho cả bộ).
 *  - Ghép với trang phục qua số trong tên file skeleton (charNNNNNN) rồi lưu thành
 *    public/assets/bd2/<nhân vật>/<trang phục>/voice/<ja|ko>/touch_N.webm — đúng quy ước của lib/voice.ts.
 * Giọng nói thuộc bản quyền Neowiz / Neon Eyes và các diễn viên lồng tiếng: chỉ dùng local, KHÔNG commit, KHÔNG deploy công khai
 * (public/assets/ đã nằm trong .gitignore).
 *
 *   node scripts/fetch-bd2-voice.mjs --dry-run         # xem độ phủ, chưa tải
 *   node scripts/fetch-bd2-voice.mjs                   # tải toàn bộ
 *   node scripts/fetch-bd2-voice.mjs --only anastasia
 *
 * Cần chạy scripts/fetch-bd2.mjs trước. Chạy lại an toàn: file đã tải thì bỏ qua.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data", "bd2.local.json");
const ASSET_DIR = join(ROOT, "public", "assets", "bd2");
const UA = "interactive-anime-local-fetch (personal fan project)";
const REPO = "jelosus2/BD2-L2D-Viewer";
const LANGS = { JP: "ja", KR: "ko" };

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const dry = flag("dry-run");
const only = opt("only") ? new Set(opt("only").split(",").map((s) => s.trim().toLowerCase())) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(DATA)) {
  console.error("Chưa có data/bd2.local.json: chạy scripts/fetch-bd2.mjs trước.");
  process.exit(1);
}
const characters = JSON.parse(readFileSync(DATA, "utf8"));

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

console.log("Đọc danh sách file giọng nói...");
const tree = await getJson(`https://api.github.com/repos/${REPO}/git/trees/HEAD?recursive=1`);
if (tree.truncated) console.warn("! danh sách bị cắt bớt");

// charId → { JP: [{ n, path, size }], KR: [...] }
const audio = new Map();
for (const e of tree.tree) {
  const m = /^src\/assets\/audios\/(\d+)\/(JP|KR)\/Char\d+_BattleReady_(\d+)\.webm$/.exec(e.path);
  if (!m) continue;
  const byLang = audio.get(m[1]) ?? {};
  (byLang[m[2]] ??= []).push({ n: Number(m[3]), path: e.path, size: e.size ?? 0 });
  audio.set(m[1], byLang);
}

const jobs = [];
for (const c of characters) {
  if (only && !only.has(c.slug)) continue;
  for (const s of c.skins) {
    const id = /char(\d+)\.skel$/.exec(s.render.skel)?.[1];
    const byLang = id && audio.get(id);
    if (!byLang) continue;
    for (const [lang, files] of Object.entries(byLang)) {
      for (const f of files) jobs.push({ slug: c.slug, skin: s.id, lang: LANGS[lang], ...f });
    }
  }
}
const covered = new Set(jobs.map((j) => `${j.slug}/${j.skin}`)).size;
const total = characters.reduce((n, c) => n + (only && !only.has(c.slug) ? 0 : c.skins.length), 0);
console.log(`${jobs.length} file cho ${covered}/${total} trang phục, ≈${(jobs.reduce((n, j) => n + j.size, 0) / 1e6).toFixed(0)} MB`);
if (dry) process.exit(0);

const rawUrl = (path) => `https://raw.githubusercontent.com/${REPO}/HEAD/${path.split("/").map(encodeURIComponent).join("/")}`;
let ok = 0;
let skipped = 0;
let failed = 0;
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const dir = join(ASSET_DIR, j.slug, j.skin, "voice", j.lang);
      const dest = join(dir, `touch_${j.n}.webm`);
      if (existsSync(dest) && statSync(dest).size === j.size) {
        skipped++;
        continue;
      }
      mkdirSync(dir, { recursive: true });
      let done = false;
      for (let i = 1; i <= 3 && !done; i++) {
        try {
          const res = await fetch(rawUrl(j.path), { headers: { "User-Agent": UA } });
          if (!res.ok) throw new Error(String(res.status));
          writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
          ok++;
          done = true;
        } catch (e) {
          if (i === 3) {
            failed++;
            console.warn(`  ! ${j.slug}/${j.skin}/${j.lang}/${j.n}: ${e.message}`);
          } else await sleep(600 * i);
        }
      }
    }
  }),
);
console.log(`Xong: ${ok} mới, ${skipped} đã có, ${failed} lỗi.`);
