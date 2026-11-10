#!/usr/bin/env node
/**
 * Lập bảng kê giọng nói data/voice.local.json từ các thư mục voice đang có trên đĩa (public/assets/.../voice/<lang>/).
 * Cần chạy TRƯỚC khi chuyển asset lên R2 và xoá khỏi đĩa: lib/voice.ts đọc bảng kê này thay cho việc quét thư mục.
 * Chạy lại mỗi khi tải thêm voice mới (scripts/fetch-voice.mjs, fetch-bd2-voice.mjs).
 *
 *   node scripts/build-voice-manifest.mjs
 *
 * Dùng thẳng hàm quét của lib/voice.ts (Node 22.18+/24 chạy được file .ts), nên bảng kê luôn đúng với cách server đọc.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanVoiceAt } from "../lib/voice.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (n) => JSON.parse(readFileSync(join(ROOT, "data", n), "utf8"));

// Cùng khoá với lib/characters.ts: NIKKE "nikke/<id bỏ tiền tố>", BD2 "bd2/<nhân vật>/<trang phục>".
const keys = [
  ...read("nikke.local.json").map((c) => `nikke/${c.id.replace(/^[a-z0-9]+-/i, "")}`),
  ...read("bd2.local.json").flatMap((c) => c.skins.map((s) => `bd2/${c.slug}/${s.id}`)),
];
const out = {};
let withVoice = 0;
for (const k of keys) {
  out[k] = scanVoiceAt(k) ?? null;
  if (out[k]) withVoice++;
}
writeFileSync(join(ROOT, "data", "voice.local.json"), JSON.stringify(out) + "\n");
console.log(`${keys.length} khoá, ${withVoice} có voice → data/voice.local.json`);
