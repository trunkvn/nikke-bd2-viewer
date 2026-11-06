#!/usr/bin/env node
/**
 * Giảm dung lượng texture Spine: PNG 2048×2048 (≈3.7MB) → WebP chất lượng cao (≈0.9MB).
 *
 *   node scripts/optimize-textures.mjs --only c010,c019      # chỉ các nhân vật này (id hoặc slug)
 *   node scripts/optimize-textures.mjs --all                  # toàn bộ
 *   node scripts/optimize-textures.mjs --all --quality 95     # chất lượng cao hơn (file lớn hơn)
 *   node scripts/optimize-textures.mjs --force                # chuyển lại cả các skin đã chuyển (khi đổi --quality)
 *   node scripts/optimize-textures.mjs --dry-run              # chỉ báo cáo, không ghi gì
 *   node scripts/optimize-textures.mjs --revert               # trỏ dữ liệu về lại PNG gốc
 *
 * Không đụng tới file gốc: với mỗi `x.atlas` + `x.png` sinh thêm `x.webp` và `x.webp.atlas` (atlas giống hệt, chỉ
 * đổi tên trang ảnh), rồi sửa data/nikke.local.json trỏ sang `.webp.atlas`. Bản gốc của JSON được giữ ở
 * data/nikke.local.json.bak. Chạy lại `fetch-nikke.mjs` sẽ ghi đè JSON và đưa dữ liệu về PNG.
 *
 * Atlas của Nikke dùng alpha nhân sẵn (pma:true). WebP giữ kênh alpha không mất mát (alphaQuality 100) và dùng
 * smartSubsample để màu ở viền các mảnh nhỏ không bị lem; RGB dưới vùng trong suốt giữ nguyên (exact) để không làm
 * hỏng giá trị nhân sẵn.
 */
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const DATA = join(ROOT, "data", "nikke.local.json");
const BACKUP = DATA + ".bak";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);

const quality = Number(opt("quality", 90));
const only = opt("only") ? new Set(opt("only").split(",").map((s) => s.trim())) : null;
const dry = flag("dry-run");
const force = flag("force");

if (!flag("all") && !only && !flag("revert")) {
  console.error("Cần --only <id,id> hoặc --all (hoặc --revert). Xem phần đầu file để biết cách dùng.");
  process.exit(1);
}

const characters = JSON.parse(readFileSync(DATA, "utf8"));
const selected = (c) => !only || only.has(c.id) || only.has(c.slug);

// ───────── hoàn tác ─────────
if (flag("revert")) {
  let n = 0;
  for (const c of characters.filter(selected))
    for (const r of renders(c)) {
      if (r.atlas.endsWith(".webp.atlas")) {
        r.atlas = r.atlas.replace(/\.webp\.atlas$/, ".atlas");
        n++;
      }
    }
  if (!dry) writeFileSync(DATA, JSON.stringify(characters, null, 2) + "\n");
  console.log(`${dry ? "[dry-run] " : ""}Đã trỏ ${n} render về PNG gốc. (File .webp vẫn còn trên đĩa; xoá tay nếu không cần.)`);
  process.exit(0);
}

/** Mọi render Spine của một nhân vật: skin chính + các tư thế aim/cover. */
function renders(c) {
  return c.skins.flatMap((s) => [s.render, ...Object.values(s.poses ?? {})]).filter((r) => r?.kind === "spine");
}

const fileOf = (url) => join(PUBLIC, url.replace(/^\//, ""));
const mb = (n) => (n / 1e6).toFixed(2);

let before = 0;
let after = 0;
let textures = 0;
let atlases = 0;
const seen = new Set();

for (const c of characters.filter(selected)) {
  for (const r of renders(c)) {
    const converted = r.atlas.endsWith(".webp.atlas");
    if (converted && !force) continue; // đã chuyển rồi (--force để chuyển lại, ví dụ đổi --quality)
    const srcAtlas = r.atlas.replace(/\.webp\.atlas$/, ".atlas");
    const atlasFile = fileOf(srcAtlas);
    if (!existsSync(atlasFile) || seen.has(atlasFile)) continue;
    seen.add(atlasFile);

    // Nhiều atlas bắt đầu bằng BOM (﻿); regex \s coi nó là khoảng trắng nên tách riêng ra rồi gắn lại khi ghi.
    const raw = readFileSync(atlasFile, "utf8");
    const bom = raw.startsWith("﻿") ? "﻿" : "";
    const text = raw.slice(bom.length);
    // Trang ảnh: dòng không thụt đầu, kết thúc ".png", và dòng kế tiếp là "size:".
    const pages = [...text.matchAll(/^([^\s:][^\r\n]*\.png)[ \t]*\r?\n[ \t]*size:/gm)].map((m) => m[1]);
    if (pages.length === 0) {
      console.warn(`bỏ qua (không thấy trang ảnh): ${srcAtlas}`);
      continue;
    }

    let atlasText = text;
    let ok = true;
    for (const page of pages) {
      const png = join(dirname(atlasFile), page);
      const webp = png.replace(/\.png$/, ".webp");
      if (!existsSync(png)) {
        console.warn(`thiếu ${page} cho ${srcAtlas}`);
        ok = false;
        break;
      }
      before += statSync(png).size;
      if (!dry && (force || !(existsSync(webp) && statSync(webp).mtimeMs > statSync(png).mtimeMs))) {
        await sharp(png)
          .webp({ quality, alphaQuality: 100, smartSubsample: true, effort: 5, exact: true })
          .toFile(webp);
      }
      after += existsSync(webp) ? statSync(webp).size : statSync(png).size * 0.25;
      textures++;
      atlasText = atlasText.replace(page, page.replace(/\.png$/, ".webp")); // lần xuất hiện đầu tiên: dòng tên trang
    }
    if (!ok) continue;

    if (!dry) writeFileSync(atlasFile.replace(/\.atlas$/, ".webp.atlas"), bom + atlasText);
    r.atlas = srcAtlas.replace(/\.atlas$/, ".webp.atlas");
    atlases++;
  }
}

if (!dry && atlases > 0) {
  if (!existsSync(BACKUP)) copyFileSync(DATA, BACKUP);
  writeFileSync(DATA, JSON.stringify(characters, null, 2) + "\n");
}

console.log(
  `${dry ? "[dry-run] " : ""}${textures} texture / ${atlases} atlas: ${mb(before)} MB → ${mb(after)} MB` +
    (before ? ` (${Math.round((after / before) * 100)}%)` : "") +
    ` · WebP q${quality}`,
);
