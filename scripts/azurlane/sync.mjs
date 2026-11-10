#!/usr/bin/env node
/**
 * Một lệnh để đưa các tàu trong scripts/azurlane/selection.json vào dự án:
 *   1. ghi bộ lọc tải (whitelist) vào <cache>/config/userconfig.toml rồi `azl download <client> --force-refresh` (chỉ tải đúng các bundle đã chọn),
 *   2. tách các bundle ra public/assets/azurlane/ (extract-live2d.py, texture WebP),
 *   3. voice (voice.mjs: tải gói cue, giải mã bằng vgmstream-cli, nén Opus); bỏ qua bằng --no-voice,
 *   4. dựng data/azurlane.local.json (fetch-azurlane.mjs; tải ảnh thẻ từ AzurAPI cho skin đã biết, ghép voice).
 * Skin chưa có ảnh: chạy tiếp scripts/azurlane/render-thumbs.mjs (cần server đang chạy) rồi chạy lại fetch-azurlane.mjs.
 *
 *   node scripts/azurlane/sync.mjs [EN|JP|CN|KR|TW] [--no-voice]
 *
 * Cần: công cụ trong tools/azl-venv (xem README), Python venv đó có UnityPy và azlassets. Dữ liệu thô nằm ở AZL_CACHE (mặc định ~/Developer/Personal/.azl-cache).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const client = process.argv.slice(2).find((a) => /^[A-Z]{2}$/.test(a)) ?? "EN";
const withVoice = !process.argv.includes("--no-voice");
const CACHE = process.env.AZL_CACHE ?? join(homedir(), "Developer", "Personal", ".azl-cache");
const VENV = join(ROOT, "tools", "azl-venv", "bin");
const selection = JSON.parse(readFileSync(join(ROOT, "scripts", "azurlane", "selection.json"), "utf8"));
const bundles = [...new Set(selection.map((e) => e.bundle))];

// Whitelist dùng str.startswith, nên bọc ký tự cuối trong [] (kích hoạt kiểu glob) để khớp ĐÚNG tên bundle, không khớp cả "lafei" lẫn "lafeier_2".
const pattern = (b) => `live2d/${b.slice(0, -1)}[${b.slice(-1)}]`;
mkdirSync(join(CACHE, "config"), { recursive: true });
writeFileSync(
  join(CACHE, "config", "userconfig.toml"),
  `[filepaths]\nasset-directory = "ClientAssets"\nextract-directory = "ClientExtract"\n\n[download.filters]\nwhitelist = [${bundles.map((b) => `"${pattern(b)}"`).join(", ")}]\nblacklist = []\n`,
);
console.log(`${bundles.length} bundle trong whitelist.`);

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
console.log("1/4 Tải bundle...");
run(join(VENV, "azl"), ["download", client, "--force-refresh"], { cwd: CACHE });
console.log("2/4 Tách Live2D...");
run(join(VENV, "python"), ["-I", join(ROOT, "scripts", "azurlane", "extract-live2d.py"), join(CACHE, "ClientAssets", client, "AssetBundles", "live2d"), join(ROOT, "public", "assets", "azurlane"), ...bundles]);
if (withVoice) {
  console.log("3/4 Voice...");
  run("node", [join(ROOT, "scripts", "azurlane", "voice.mjs"), client]);
}
console.log("4/4 Dựng dữ liệu...");
run("node", [join(ROOT, "scripts", "fetch-azurlane.mjs")]);
