#!/usr/bin/env node
/**
 * Tải giọng nói gốc của nhân vật từ wiki cộng đồng (MediaWiki API) để dùng LOCAL.
 * File âm thanh thuộc bản quyền Shift Up / Level Infinite và diễn viên lồng tiếng: KHÔNG commit,
 * KHÔNG deploy công khai (public/assets/ đã nằm trong .gitignore).
 *
 *   node scripts/fetch-voice.mjs c010                    # một nhân vật (tiếng Anh, Fandom wiki quốc tế)
 *   node scripts/fetch-voice.mjs --all                   # toàn bộ nhân vật trong data/nikke.local.json
 *   node scripts/fetch-voice.mjs --all --dry-run         # xem trước độ phủ, chưa tải
 *   node scripts/fetch-voice.mjs c010 --enter 3 --touch 6    # lấy nhiều câu hơn (mặc định: 1 enter + 2 touch)
 *   node scripts/fetch-voice.mjs c010 --lang ja --api <api.php của wiki khác> --page "Tên trang"
 *
 * Với --all, nhân vật đã có sẵn thư mục voice/<lang> sẽ được bỏ qua (thêm --force để tải lại; file bạn tự
 * đặt vào thư mục ngôn ngữ khác như ja/ không bao giờ bị đụng tới).
 *
 * Nhân vật có diễn viên lồng tiếng giống hệt nhau ở mọi gói ngôn ngữ (va_en = va_jp, thường là nhân vật
 * collab như Evangelion, Chainsaw Man, Persona...) thì giọng trên wiki thực chất là tiếng Nhật: script tự lưu
 * vào voice/ja/ thay vì voice/en/ (phụ đề vẫn là bản dịch tiếng Anh của wiki).
 *
 * Trang lời thoại dùng template {{Nikke Voicelines}} với cặp `nvoi`/`ndlg` (file ↔ lời thoại).
 * Phân loại:
 *   touch ← Interaction_N, Interaction_Voiceline_N   (chạm ở sảnh)
 *   enter ← Gacha, Joining_Party, Field_Touch        (chào / nhận lệnh)
 * Kết quả: public/assets/nikke/<id>/voice/<lang>/{enter,touch}_N.wav + captions.json
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWikiMetaSmart } from "./lib/wiki-meta.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_API = "https://nikke-goddess-of-victory-international.fandom.com/api.php";
const UA = "interactive-anime-local-fetch (personal fan project)";
const LOCAL_FILE = join(ROOT, "data", "nikke.local.json");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const all = flag("all");
if (!id && !all) {
  console.error("Dùng: node scripts/fetch-voice.mjs <id, ví dụ c010> | --all  [--lang en] [--dry-run] [--force] [--enter N --touch N]");
  process.exit(1);
}
const lang = opt("lang", "en");
const api = opt("api", DEFAULT_API);
// Mặc định lấy ít cho gọn: 1 câu chào + 2 câu khi nhấp (theo thứ tự trên trang wiki).
const limits = { enter: Number(opt("enter", 1)), touch: Number(opt("touch", 2)) };
const dryRun = flag("dry-run");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(params) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${api}?${new URLSearchParams({ format: "json", ...params })}`, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(800 * attempt);
    }
  }
}

/** Gỡ markup wiki: [[A|B]] → B, [[A]] → A, <br> → khoảng trắng, ''nghiêng''. */
const cleanText = (s) =>
  s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/gi, "")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const TOUCH = /_Interaction(?:_Voiceline)?_\d+\.\w+$/i;
const ENTER = /_(?:Gacha|Joining_Party|Field_Touch)\.\w+$/i;

/** Đọc trang lời thoại → { enter: [{title,text}], touch: [...] } hoặc { error }. */
async function readVoicelines(page) {
  const parsed = await getJson({ action: "parse", page, prop: "wikitext" });
  if (parsed.error) return { error: parsed.error.info };
  const wikitext = parsed.parse.wikitext["*"];

  // Ghép file ↔ lời thoại theo khoá (nvoi 1a ↔ ndlg 1a), không phụ thuộc thứ tự dòng.
  const voi = new Map();
  const dlg = new Map();
  for (const line of wikitext.split("\n")) {
    const f = /^\s*\|\s*([nc])voi\s*([0-9a-z]*)\s*=\s*\[\[File:(.+?)\]\]/i.exec(line);
    if (f) voi.set(`${f[1]}${f[2]}`.toLowerCase(), f[3].trim());
    const d = /^\s*\|\s*([nc])dlg\s*([0-9a-z]*)\s*=\s*(.*)$/i.exec(line);
    if (d) dlg.set(`${d[1]}${d[2]}`.toLowerCase(), cleanText(d[3]));
  }
  const picked = { enter: [], touch: [] };
  for (const [key, title] of voi) {
    const norm = title.replace(/ /g, "_");
    const entry = { title, text: dlg.get(key) ?? "" };
    if (TOUCH.test(norm)) picked.touch.push(entry);
    else if (ENTER.test(norm)) picked.enter.push(entry);
  }
  picked.enter = picked.enter.slice(0, limits.enter);
  picked.touch = picked.touch.slice(0, limits.touch);
  return { picked, filesFound: voi.size };
}

/** Khoá so khớp tên file: MediaWiki gộp nhiều dấu cách/gạch dưới liền nhau thành một. */
const normTitle = (s) => s.replace(/[\s_]+/g, "_");

/** Tải các file đã chọn vào voice/<lang>/. @returns số file lưu được */
async function downloadVoice(charId, picked, outLang) {
  const titles = [...picked.enter, ...picked.touch].map((p) => `File:${p.title}`);
  const info = await getJson({ action: "query", titles: titles.join("|"), prop: "imageinfo", iiprop: "url|mime" });
  const urlByTitle = new Map();
  for (const p of Object.values(info.query.pages)) {
    const url = p.imageinfo?.[0]?.url;
    if (url) urlByTitle.set(normTitle(p.title), url);
  }

  const outDir = join(ROOT, "public", "assets", "nikke", charId, "voice", outLang);
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (/^(enter|touch)_\d+\.\w+$/.test(f)) rmSync(join(outDir, f));

  const captions = {};
  let saved = 0;
  for (const trigger of ["enter", "touch"]) {
    let n = 0;
    for (const { title, text } of picked[trigger]) {
      const url = urlByTitle.get(normTitle(`File:${title}`));
      if (!url) {
        console.error(`    ! không có URL cho ${title}`);
        continue;
      }
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        console.error(`    ! tải lỗi ${title} (${res.status})`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = (/\.(\w+)$/.exec(title)?.[1] ?? "wav").toLowerCase();
      // Kiểm tra header để chắc đây là âm thanh thật chứ không phải trang HTML lỗi.
      const magic = buf.subarray(0, 4).toString("ascii");
      if (!["RIFF", "OggS", "ID3"].includes(magic) && !(buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
        console.error(`    ! ${title}: nội dung không phải file âm thanh, bỏ qua`);
        continue;
      }
      const file = `${trigger}_${++n}.${ext}`;
      writeFileSync(join(outDir, file), buf);
      if (text) captions[file] = text;
      saved++;
      await sleep(200); // nhẹ tay với server wiki
    }
  }
  writeFileSync(join(outDir, "captions.json"), JSON.stringify(captions, null, 2) + "\n");
  return saved;
}

const hasVoice = (charId, l) => {
  const dir = join(ROOT, "public", "assets", "nikke", charId, "voice", l);
  return existsSync(dir) && readdirSync(dir).some((f) => /^(enter|touch)_\d+\.\w+$/.test(f));
};

// ───────────────────────── Chạy ─────────────────────────
if (!existsSync(LOCAL_FILE) && !opt("page")) {
  console.error("Chưa có data/nikke.local.json — chạy scripts/fetch-nikke.mjs trước (hoặc truyền --name và --page).");
  process.exit(1);
}
const characters = existsSync(LOCAL_FILE) ? JSON.parse(readFileSync(LOCAL_FILE, "utf8")) : [];
const targets = all
  ? characters.map((c) => ({ id: c.id.replace(/^nikke-/, ""), name: c.name }))
  : [{ id, name: opt("name") ?? characters.find((c) => c.id === `nikke-${id}`)?.name }];
if (targets.some((t) => !t.name)) {
  console.error(`Không biết tên nhân vật cho ${id}: chạy fetch-nikke.mjs ${id} trước hoặc truyền --name`);
  process.exit(1);
}

// Tên trong dữ liệu có thể khác tên trang wiki ("Asuka" → "Asuka Shikinami Langley"): lấy tên trang thật từ infobox.
const wiki = opt("page") ? new Map() : await fetchWikiMetaSmart(targets.map((t) => t.name));

/** Chỉ áp dụng khi tải ngôn ngữ mặc định (en) từ wiki quốc tế, không áp dụng khi người dùng tự chọn --lang/--api. */
const isJapanOnly = (name) => {
  const w = wiki.get(name);
  return !opt("lang") && !opt("api") && Boolean(w?.vaEn && w?.vaJp && w.vaEn.toLowerCase() === w.vaJp.toLowerCase());
};

// Dọn các voice đã tải nhầm vào en/ từ trước: nhân vật chỉ có giọng Nhật thì chuyển en/ → ja/ (không ghi đè ja/ có sẵn).
for (const t of targets) {
  if (!isJapanOnly(t.name)) continue;
  const base = join(ROOT, "public", "assets", "nikke", t.id, "voice");
  if (existsSync(join(base, "en")) && !existsSync(join(base, "ja")) && !dryRun) {
    renameSync(join(base, "en"), join(base, "ja"));
    console.log(`↪ ${t.id} ${t.name}: chuyển voice/en → voice/ja (chỉ có giọng Nhật)`);
  }
}

const summary = { saved: [], skipped: [], noPage: [], noLines: [], partial: [] };
let i = 0;
for (const t of targets) {
  i++;
  const tag = `[${i}/${targets.length}] ${t.id} ${t.name}`;
  const outLang = isJapanOnly(t.name) ? "ja" : lang;
  if (all && !flag("force") && hasVoice(t.id, outLang)) {
    summary.skipped.push(t.name);
    continue;
  }
  const pageTitle = opt("page") ?? `${wiki.get(t.name)?.title ?? t.name}/Voicelines`;
  const result = await readVoicelines(pageTitle);
  await sleep(250);
  if (result.error) {
    console.log(`${tag}: không có trang "${pageTitle}"`);
    summary.noPage.push(t.name);
    continue;
  }
  const { enter, touch } = result.picked;
  if (enter.length + touch.length === 0) {
    console.log(`${tag}: trang có ${result.filesFound} file nhưng không khớp enter/touch`);
    summary.noLines.push(t.name);
    continue;
  }
  if (dryRun) {
    console.log(`${tag}: enter ${enter.length}, touch ${touch.length}  ← ${pageTitle}`);
    (enter.length && touch.length ? summary.saved : summary.partial).push(t.name);
    continue;
  }
  const saved = await downloadVoice(t.id, result.picked, outLang);
  console.log(`${tag}: ${saved}/${enter.length + touch.length} file${outLang !== lang ? ` → ${outLang}/ (giọng Nhật)` : ""}`);
  (saved === enter.length + touch.length && enter.length && touch.length ? summary.saved : summary.partial).push(t.name);
}

console.log(
  `\nTổng kết${dryRun ? " (dry-run)" : ""}: đủ ${summary.saved.length} · thiếu một loại ${summary.partial.length} · ` +
    `đã có sẵn ${summary.skipped.length} · không có trang ${summary.noPage.length} · không khớp ${summary.noLines.length}`,
);
if (summary.partial.length) console.log("  thiếu enter/touch:", summary.partial.join(", "));
if (summary.noPage.length) console.log("  không có trang lời thoại:", summary.noPage.join(", "));
if (summary.noLines.length) console.log("  không khớp quy ước tên file:", summary.noLines.join(", "));
