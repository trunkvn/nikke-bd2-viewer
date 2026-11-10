#!/usr/bin/env node
/**
 * Sinh bộ icon của site từ hai dấu hiệu tự vẽ (không dùng logo gốc của game):
 *   NIKKE: ô vàng cắt góc + chữ N (giống logo ở header), nền tối.  Brown Dust 2: ô tím đêm viền vàng + chữ B vàng.
 *   Azur Lane: khiên xanh da trời chữ A.  Trang chủ: ô bo góc chuyển màu từ vàng sang chàm + ngôi sao bốn cánh.
 *
 * Ghi:
 *   app/(nikke)/nikke/icon.svg, apple-icon.png   app/(bd2)/bd2/icon.svg, apple-icon.png   app/(home)/icon.svg, apple-icon.png   (favicon trong tab, màn hình chính iOS)
 *   app/(nikke)/nikke/icon1.ico, app/(bd2)/bd2/icon1.ico, app/(home)/icon1.ico   (trình duyệt không đọc SVG). Không đặt app/favicon.ico ở gốc: nó sẽ kéo theo
 *                                           cả trang BD2 và tab BD2 có thể hiện nhầm icon NIKKE.
 *   public/icons/{nikke,bd2,azurlane,home}-{192,512}.png  (manifest; vẽ tràn nền để dùng được làm icon "maskable")
 *
 *   node scripts/generate-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (...p) => join(ROOT, ...p);

// Hình chữ trong khung 64×64.
const N = "M18 48V16h8.5L39 34.5V16h7v32h-8.5L25 29.5V48z";
const B = "M20 16h15.5c6.2 0 9.8 3 9.8 8 0 3.4-1.8 5.8-4.8 7 4 1 6.3 3.9 6.3 8 0 6-4.3 9-11 9H20zM27.5 22v6h6.2c2.4 0 3.8-1 3.8-3s-1.4-3-3.8-3zM27.5 34v8h7c3 0 4.5-1.5 4.5-4s-1.5-4-4.5-4z";

// Chữ A (có lỗ tam giác) cho dấu hiệu Azur Lane.
const A = "M32 12 46 51h-7l-2.4-7H27.4L25 51h-7zM29.6 38h4.8L32 30z";

const STAR = "M32 8C34 24 40 30 56 32 40 34 34 40 32 56 30 40 24 34 8 32 24 30 30 24 32 8Z";

const MARKS = {
  azurlane: {
    ink: "#04121f",
    bg: "#38bdf8",
    path: A,
    // Khiên xanh da trời với mũi nhọn ở dưới (giống dấu hiệu ở header).
    shape: '<path fill="#38bdf8" d="M4 4h56v38L32 61 4 42z"/>',
  },
  home: {
    ink: "#0a0b10",
    bg: "url(#g)",
    path: STAR,
    defs: '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5d90a"/><stop offset="1" stop-color="#6f6fe8"/></linearGradient></defs>',
    shape: '<rect width="64" height="64" rx="15" fill="url(#g)"/>',
  },
  nikke: {
    ink: "#06080c",
    bg: "#f5d90a",
    path: N,
    // Ô cắt góc trên-trái và dưới-phải như logo ở header.
    shape: '<path fill="#f5d90a" d="M12 0h52v52L52 64H0V12z"/>',
  },
  bd2: {
    ink: "#e9cb7d",
    bg: "#1b1442",
    path: B,
    // Ô tím đêm bo góc, viền vàng mảnh bên trong, chữ B vàng.
    shape: '<rect width="64" height="64" rx="15" fill="#1b1442"/><rect x="3" y="3" width="58" height="58" rx="12" fill="none" stroke="#e9cb7d" stroke-opacity=".7" stroke-width="1.5"/>',
  },
};

const svg = (m, shape = m.shape) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${m.defs ?? ""}${shape}<path fill="${m.ink}" fill-rule="evenodd" d="${m.path}"/></svg>\n`;
/** Nền tràn khung (apple-icon, maskable): hệ điều hành tự bo góc/cắt hình. */
const fullBleed = (m) => svg(m, `<rect width="64" height="64" fill="${m.bg}"/>`);

const png = (xml, size) => sharp(Buffer.from(xml), { density: 384 }).resize(size, size).png().toBuffer();

/** ICO chứa các ảnh PNG (định dạng từ Windows Vista, mọi trình duyệt hiện nay đều đọc được). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); // planes
    head.writeUInt16LE(32, e + 6); // bit depth
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}

const where = { nikke: out("app", "(nikke)", "nikke"), bd2: out("app", "(bd2)", "bd2"), azurlane: out("app", "(azurlane)", "azurlane"), home: out("app", "(home)") };
mkdirSync(out("public", "icons"), { recursive: true });

for (const [key, m] of Object.entries(MARKS)) {
  writeFileSync(join(where[key], "icon.svg"), svg(m));
  writeFileSync(join(where[key], "apple-icon.png"), await png(fullBleed(m), 180));
  for (const size of [192, 512]) writeFileSync(out("public", "icons", `${key}-${size}.png`), await png(fullBleed(m), size));
}

const sizes = [16, 32, 48];
for (const [key, m] of Object.entries(MARKS)) {
  const images = await Promise.all(sizes.map(async (size) => ({ size, data: await png(svg(m), size) })));
  writeFileSync(join(where[key], "icon1.ico"), ico(images));
}
console.log("Đã ghi icon cho NIKKE, Brown Dust 2, Azur Lane và trang chủ.");
