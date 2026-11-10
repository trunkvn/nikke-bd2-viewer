#!/usr/bin/env node
/**
 * Giảm texture Live2D của Azur Lane: ảnh lớn hơn 2048 điểm ảnh (phần lớn là 4096×4096, ≈2,8 MB và ≈67 MB bộ nhớ GPU mỗi tấm)
 * được thu nhỏ về 2048 (≈1 MB, ≈17 MB GPU). Texture nhỏ hơn không bị đụng tới nên chạy lại nhiều lần cũng an toàn.
 *
 * Tên file giữ nguyên (model3.json không phải sửa): Cubism dựng UV theo tỉ lệ nên đổi kích thước ảnh không làm lệch hình.
 * Bản gốc được chép sang thư mục sao lưu (mặc định ~/Developer/Personal/.azl-cache/texture-backup/<bundle>/) trước khi ghi đè;
 * lấy lại bản gốc bằng --restore. Chạy lại extract-live2d.py sẽ ghi đè bằng ảnh gốc 4096, khi đó chạy lại script này.
 *
 *   node scripts/azurlane/shrink-textures.mjs --dry-run     # chỉ báo cáo
 *   node scripts/azurlane/shrink-textures.mjs               # thu nhỏ (kèm sao lưu)
 *   node scripts/azurlane/shrink-textures.mjs --restore     # trả bản gốc từ thư mục sao lưu
 *   node scripts/azurlane/shrink-textures.mjs --max 1536    # ngưỡng khác (mặc định 2048)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ASSETS = join(ROOT, "public", "assets", "azurlane");
const BACKUP = process.env.AZL_TEXTURE_BACKUP ?? join(homedir(), "Developer", "Personal", ".azl-cache", "texture-backup");
const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const restore = argv.includes("--restore");
const max = Number(argv[argv.indexOf("--max") + 1]) || 2048;

const bundles = readdirSync(ASSETS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
let before = 0, after = 0, count = 0;
for (const b of bundles) {
  const dir = join(ASSETS, b);
  for (const f of readdirSync(dir).filter((n) => /^texture_\d+\.webp$/.test(n))) {
    const file = join(dir, f), saved = join(BACKUP, b, f);
    if (restore) {
      if (existsSync(saved)) { copyFileSync(saved, file); count++; }
      continue;
    }
    const meta = await sharp(file).metadata();
    if (Math.max(meta.width, meta.height) <= max) continue;
    const size = statSync(file).size;
    const scale = max / Math.max(meta.width, meta.height);
    const buf = await sharp(file)
      .resize(Math.round(meta.width * scale), Math.round(meta.height * scale), { kernel: "lanczos3" })
      .webp({ quality: 90, alphaQuality: 100, smartSubsample: true, exact: true }) // exact: giữ RGB dưới vùng trong suốt để viền các mảnh không lem
      .toBuffer();
    before += size; after += buf.length; count++;
    if (dry) continue;
    if (!existsSync(saved)) { mkdirSync(dirname(saved), { recursive: true }); copyFileSync(file, saved); }
    writeFileSync(file + ".tmp", buf);
    renameSync(file + ".tmp", file);
  }
}
if (restore) console.log(`Đã trả ${count} texture từ ${BACKUP}`);
else console.log(`${dry ? "(chạy thử) " : ""}${count} texture: ${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(0)} MB${dry ? "" : `, bản gốc ở ${BACKUP}`}`);
