#!/usr/bin/env node
/**
 * Lấy thứ tự phát Ultimate "chỉnh tay" của từng nhân vật Brown Dust 2 (cut_all, cut_A_all, cut_B_all...) để dùng LOCAL.
 *  - Nguồn: src/utils/cutscene_mappings.ts của jelosus2/BD2-L2D-Viewer (MIT). Mỗi nhân vật có một hay vài "chuỗi": danh sách các bước nối
 *    tiếp nhau, mỗi bước là một animation (kèm thời lượng phát `playDuration`, lệch `offset`, `hold`, `loop`) hoặc một nhóm chạy song song.
 *  - File được đọc như DỮ LIỆU (chuyển cú pháp TypeScript sang JSON rồi phân tích), không bao giờ được chạy như mã.
 *  - Kết quả: data/bd2.sequences.local.json, khoá theo số trong tên skeleton (charNNNNNN), lib/characters.ts gắn vào `Skin.cutscene.sequences`.
 *    Tham chiếu tới chuỗi khác (ví dụ "cut_A_all" nằm trong "cut_all") được trải phẳng; bước dùng skeleton phụ (`source`, 7 bước ở 2
 *    nhân vật) bị bỏ vì ta không tải skeleton đó.
 *
 *   node scripts/fetch-bd2-sequences.mjs            # tải và ghi
 *   node scripts/fetch-bd2-sequences.mjs --dry-run  # chỉ thống kê
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "bd2.sequences.local.json");
const URL_ = "https://raw.githubusercontent.com/jelosus2/BD2-L2D-Viewer/HEAD/src/utils/cutscene_mappings.ts";
const dry = process.argv.includes("--dry-run");

const res = await fetch(URL_, { headers: { "User-Agent": "interactive-anime-local-fetch (personal fan project)" } });
if (!res.ok) throw new Error(`${res.status} ${URL_}`);
const text = await res.text();

// TypeScript → JSON: lấy literal sau `const cutsceneComposites ... =`, bỏ chú thích, đặt dấu nháy cho khoá, bỏ dấu phẩy thừa.
const eq = text.indexOf("=", text.indexOf("const cutsceneComposites"));
const start = text.indexOf("{", eq);
const end = text.lastIndexOf("}", text.indexOf("export default"));
const json = text
  .slice(start, end + 1)
  .replace(/\/\/[^\n]*/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/([{,\s])([A-Za-z_][A-Za-z_0-9]*)\s*:/g, '$1"$2":')
  .replace(/,(\s*[}\]])/g, "$1");
const raw = JSON.parse(json);

const isDef = (d) => d && typeof d === "object" && !Array.isArray(d) && ("composite" in d || "animations" in d);
const defsOf = (e) => (Array.isArray(e) && e.length && e.every(isDef) ? e : isDef(e) ? [e] : [{ name: "all", composite: e }]);

let droppedSources = 0;
/** Một bước → nút: { a } (animation), { s } (tuần tự), { p } (song song); null nếu phải bỏ. */
function compile(spec, defs, ancestors) {
  if (typeof spec === "string") {
    const nested = defs.find((d) => (d.name ?? "all") === spec);
    if (nested && !ancestors.includes(spec)) return compileSeq(nested.composite ?? nested.animations, defs, [...ancestors, spec]);
    return { a: spec };
  }
  if (spec.source) {
    droppedSources++;
    return null;
  }
  const node = { a: spec.name };
  if (spec.offset) node.o = spec.offset;
  if (spec.playDuration) node.d = spec.playDuration;
  if (spec.hold) node.h = true;
  if (spec.loop) node.l = true;
  return node;
}
function compileSeq(steps, defs, ancestors) {
  const children = [];
  for (const step of steps) {
    if (Array.isArray(step)) {
      // Song song: xếp theo layerOrder (thấp vẽ trước/phía sau), cùng layerOrder giữ thứ tự trong mảng.
      const items = step
        .map((s, i) => ({ s, i, order: typeof s === "object" ? (s.layerOrder ?? 0) : 0 }))
        .sort((a, b) => a.order - b.order || a.i - b.i)
        .map(({ s }) => compile(s, defs, ancestors))
        .filter(Boolean);
      if (items.length) children.push({ p: items });
    } else {
      const n = compile(step, defs, ancestors);
      if (n) children.push(n);
    }
  }
  return { s: children };
}

const out = {};
let nDefs = 0;
for (const [id, entry] of Object.entries(raw)) {
  const defs = defsOf(entry);
  out[id] = defs.map((d) => ({ name: d.name ?? "all", node: compileSeq(d.composite ?? d.animations, defs, [d.name ?? "all"]) }));
  nDefs += defs.length;
}
console.log(`${Object.keys(out).length} nhân vật, ${nDefs} chuỗi, bỏ ${droppedSources} bước dùng skeleton phụ.`);
if (!dry) {
  writeFileSync(OUT, JSON.stringify(out) + "\n");
  console.log(`Đã ghi ${OUT}`);
}
