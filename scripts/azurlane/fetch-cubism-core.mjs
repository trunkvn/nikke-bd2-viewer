#!/usr/bin/env node
/**
 * Tải lõi Live2D Cubism (live2dcubismcore.min.js) từ trang chính thức của Live2D về public/vendor/ để viewer Azur Lane dùng.
 * Đây là phần mềm độc quyền của Live2D Inc. (điều khoản: Live2D Proprietary Software License). Dùng cho bản chạy local cá nhân; thư mục
 * public/vendor/ đã nằm trong .gitignore, đừng đưa file này vào git hay phân phối lại.
 *
 *   node scripts/azurlane/fetch-cubism-core.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_ = "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";
const res = await fetch(URL_, { headers: { "User-Agent": "interactive-anime-local-fetch (personal fan project)" } });
if (!res.ok) throw new Error(`${res.status} ${URL_}`);
const text = await res.text();
if (!text.includes("Live2DCubismCore")) throw new Error("File tải về không giống lõi Cubism.");
mkdirSync(join(ROOT, "public", "vendor"), { recursive: true });
writeFileSync(join(ROOT, "public", "vendor", "live2dcubismcore.min.js"), text);
console.log(`Đã ghi public/vendor/live2dcubismcore.min.js (${(text.length / 1024).toFixed(0)} KB). Phiên bản: ${/Cubism Core.*?(\d+\.\d+\.\d+)/i.exec(text.slice(0, 600))?.[1] ?? "?"}`);
