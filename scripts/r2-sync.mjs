#!/usr/bin/env node
/**
 * Đồng bộ asset trong public/assets lên bucket Cloudflare R2 RIÊNG TƯ (xem lib/r2.ts, app/assets/[...path]/route.ts).
 *
 * Chỉ tải những file thật sự được dữ liệu tham chiếu, không tải bản gốc còn sót lại (PNG/WAV cạnh bản WebP/WebM đã nén...):
 *   - mọi chuỗi bắt đầu bằng "/assets/" trong data/*.local.json (skel, atlas, ảnh thumb, voice trong data/voice.local.json...),
 *   - các trang texture ghi trong từng file .atlas.
 * Trước đó phải có data/voice.local.json: node scripts/build-voice-manifest.mjs
 *
 *   node --env-file-if-exists=.env.local scripts/r2-sync.mjs             # chỉ kiểm tra và thống kê (không cần khoá R2)
 *   node --env-file-if-exists=.env.local scripts/r2-sync.mjs --upload    # tải lên, bỏ qua file đã có cùng kích thước
 *   ... --upload --force                                                 # tải lại tất cả
 *
 * Cần R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET trong .env.local (R2_ENDPOINT tuỳ chọn).
 * Script này không bao giờ xoá gì: không xoá file trên đĩa, không xoá object trên R2.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const argv = process.argv.slice(2);
const upload = argv.includes("--upload");
const force = argv.includes("--force");
const CONCURRENCY = Number(argv[argv.indexOf("--concurrency") + 1]) || 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

const TYPES = {
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".webm": "audio/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".json": "application/json",
  ".atlas": "text/plain; charset=utf-8", ".skel": "application/octet-stream",
};

// ───────── 1. tập file được tham chiếu ─────────
if (!existsSync(join(ROOT, "data", "voice.local.json"))) {
  console.error("Chưa có data/voice.local.json: chạy node scripts/build-voice-manifest.mjs trước (không thì voice sẽ bị bỏ sót).");
  process.exit(1);
}
const urls = new Set();
const walk = (o) => {
  if (typeof o === "string") {
    if (o.startsWith("/assets/")) urls.add(o);
  } else if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === "object") Object.values(o).forEach(walk);
};
for (const f of readdirSync(join(ROOT, "data")).filter((f) => f.endsWith(".local.json"))) walk(JSON.parse(readFileSync(join(ROOT, "data", f), "utf8")));

const fileOf = (url) => join(PUBLIC, ...url.split("/").map((s) => decodeURIComponent(s)));

// Trang texture của mỗi atlas nằm cùng thư mục với atlas.
for (const url of [...urls].filter((u) => u.endsWith(".atlas"))) {
  const file = fileOf(url);
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8").replace(/^﻿/, "");
  for (const m of text.matchAll(/^([^\s:][^\r\n]*\.(?:png|webp|jpe?g))[ \t]*\r?\n[ \t]*size:/gm)) urls.add(`${url.slice(0, url.lastIndexOf("/") + 1)}${encodeURI(m[1])}`);
}

const files = [];
const missing = [];
for (const url of urls) {
  const file = fileOf(url);
  if (existsSync(file) && statSync(file).isFile()) files.push({ url, key: url.slice(1), file, size: statSync(file).size });
  else missing.push(url);
}
const total = files.reduce((n, f) => n + f.size, 0);

// ───────── 2. thống kê ─────────
const onDisk = [];
(function scan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (e.isFile()) onDisk.push({ file: p, size: statSync(p).size });
  }
})(join(PUBLIC, "assets"));
const wanted = new Set(files.map((f) => f.file));
const extra = onDisk.filter((f) => !wanted.has(f.file));
const byExt = {};
for (const f of extra) byExt[extname(f.file) || "(không đuôi)"] = (byExt[extname(f.file) || "(không đuôi)"] ?? 0) + f.size;

console.log(`Được tham chiếu: ${files.length} file, ${mb(total)}`);
console.log(`Trên đĩa:        ${onDisk.length} file, ${mb(onDisk.reduce((n, f) => n + f.size, 0))}`);
console.log(`Không tham chiếu (sẽ KHÔNG tải lên): ${extra.length} file, ${mb(extra.reduce((n, f) => n + f.size, 0))}  [${Object.entries(byExt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e, s]) => `${e} ${mb(s)}`).join(", ")}]`);
if (missing.length) {
  console.warn(`! ${missing.length} đường dẫn được tham chiếu nhưng không có trên đĩa (ví dụ: ${missing.slice(0, 3).join(", ")})`);
}
if (total > 10e9) console.warn("! Vượt 10 GB: có thể vượt gói miễn phí của R2.");
if (!upload) {
  console.log("\nChế độ kiểm tra. Thêm --upload để tải lên R2.");
  process.exit(0);
}

// ───────── 3. tải lên ─────────
const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket, R2_ENDPOINT: endpoint } = process.env;
if (!accessKeyId || !secretAccessKey || !bucket || (!account && !endpoint)) {
  console.error("Thiếu R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET (đặt trong .env.local).");
  process.exit(1);
}
const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
const base = `${(endpoint ?? `https://${account}.r2.cloudflarestorage.com`).replace(/\/+$/, "")}/${encodeURIComponent(bucket)}`;
const target = (key) => `${base}/${key}`; // key đã được mã hoá từng đoạn

async function put(f) {
  for (let i = 1; i <= 4; i++) {
    try {
      if (!force) {
        const head = await client.fetch(target(f.key), { method: "HEAD" });
        if (head.ok && Number(head.headers.get("content-length")) === f.size) return "skip";
      }
      const res = await client.fetch(target(f.key), {
        method: "PUT",
        headers: { "Content-Type": TYPES[extname(f.file).toLowerCase()] ?? "application/octet-stream" },
        body: readFileSync(f.file),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return "ok";
    } catch (e) {
      if (i === 4) return `lỗi (${e.message})`;
      await sleep(700 * i);
    }
  }
}

const queue = [...files];
const stat = { ok: 0, skip: 0, fail: [] };
let done = 0;
let sent = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const r = await put(f);
      if (r === "ok") {
        stat.ok++;
        sent += f.size;
      } else if (r === "skip") stat.skip++;
      else stat.fail.push(`${f.key}: ${r}`);
      if (++done % 250 === 0) console.log(`  ${done}/${files.length}  (đã tải ${mb(sent)})`);
    }
  }),
);
console.log(`Xong: ${stat.ok} tải lên (${mb(sent)}), ${stat.skip} đã có sẵn, ${stat.fail.length} lỗi.`);
for (const f of stat.fail.slice(0, 10)) console.warn("  !", f);
process.exit(stat.fail.length ? 1 : 0);
