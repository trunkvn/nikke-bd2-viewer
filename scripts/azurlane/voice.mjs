#!/usr/bin/env node
/**
 * Voice của Azur Lane (LOCAL). Với các skin trong scripts/azurlane/selection.json:
 *   1. ghép skin → mã voice: AzurLaneData (github.com/AzurLaneTools/AzurLaneData, EN) có ship_skin_template (cột `painting` = tên bundle Live2D) và
 *      ship_skin_words (lời thoại từng skin + `voice_key`). `voice_key` chính là mã của gói `cue/cv-<voice_key>.b`,
 *   2. tải đúng các gói đó bằng azlassets (bộ lọc whitelist, chỉ vài MB mỗi gói),
 *   3. giải mã bằng vgmstream-cli (gói là ACB của CRIWARE, âm thanh HCA không mã hoá) rồi nén Opus/WebM bằng ffmpeg:
 *      public/assets/azurlane/voice/<voice_key>/<cue>.webm,
 *   4. ghi data/azurlane.voice.local.json (skin → voice_key, và mỗi voice_key → { cue: { src, text } }).
 * fetch-azurlane.mjs ghép dữ liệu này vào từng skin; viewer phát voice khi hoạt cảnh tương ứng bắt đầu (kèm nhép miệng) và hiện phụ đề.
 *
 *   node scripts/azurlane/voice.mjs [EN] [--force]
 *
 * Cần: tools/azl-venv (azlassets), vgmstream-cli (brew install vgmstream) và ffmpeg có libopus. Asset thuộc Manjuu / Yostar: chỉ dùng local
 * (public/assets/ và data/*.local.json đã gitignore). Không giải mã gì cần khoá: nếu HCA bị mã hoá thì script dừng ở bundle đó.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE, skinForBundle, skinTemplate, skinWords } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const client = argv.find((a) => /^[A-Z]{2}$/.test(a)) ?? "EN";
const force = argv.includes("--force");
const OUT_DIR = join(ROOT, "public", "assets", "azurlane", "voice");
const OUT_DATA = join(ROOT, "data", "azurlane.voice.local.json");

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
for (const [cmd, probe] of [["vgmstream-cli", ["-h"]], ["ffmpeg", ["-version"]]]) {
  if (sh(cmd, probe).error) {
    console.error(`Không tìm thấy ${cmd} trong PATH.`);
    process.exit(1);
  }
}

// 1. dữ liệu AzurLaneData
const template = await skinTemplate();
const words = await skinWords();
const baseWordsOf = (group, key) => {
  const base = Object.values(template).find((s) => String(s.ship_group) === group && words[s.id]?.voice_key === key);
  return base ? words[base.id] : undefined;
};

const selection = JSON.parse(readFileSync(join(ROOT, "scripts", "azurlane", "selection.json"), "utf8"));
const bundleKey = {};
const keyWords = {};
for (const { bundle, ship } of selection) {
  const skin = skinForBundle(template, bundle, ship);
  const own = skin && words[skin.id];
  if (!own) {
    console.warn(`! ${bundle}: không thấy skin trong dữ liệu`);
    continue;
  }
  // voice_key = "0" (hoặc trống): skin không có voice riêng, dùng voice của tàu gốc: mã gói = ship_group, lời thoại của skin gốc.
  // Skin có voice_key riêng (ví dụ skin đặc biệt được thu âm lại) thì dùng mã và lời thoại riêng.
  let key = own.voice_key;
  let w = own;
  if (!key || key === "0" || key === "-1") {
    key = String(skin.ship_group);
    w = baseWordsOf(key, key) ?? own;
  }
  bundleKey[bundle] = String(key);
  keyWords[String(key)] ??= w;
}
const keys = Object.keys(keyWords);
console.log(`${Object.keys(bundleKey).length} skin → ${keys.length} bộ voice.`);

// 2. tải các gói cue (whitelist khớp ĐÚNG tên: ký tự [] kích hoạt kiểu glob)
mkdirSync(join(CACHE, "config"), { recursive: true });
writeFileSync(
  join(CACHE, "config", "userconfig.toml"),
  `[filepaths]\nasset-directory = "ClientAssets"\nextract-directory = "ClientExtract"\n\n[download.filters]\nwhitelist = [${keys.map((k) => `"cue/cv-${k}.[b]"`).join(", ")}]\nblacklist = []\n`,
);
const dl = sh(join(ROOT, "tools", "azl-venv", "bin", "azl"), ["download", client, "--force-refresh"], { cwd: CACHE, stdio: "inherit" });
if (dl.status !== 0) process.exit(dl.status ?? 1);

// 3. giải mã
/** cue (tên luồng trong ACB) → văn bản, theo cách game đặt tên: main_N lấy từ `main` tách bằng "|". */
function cueTexts(w) {
  const t = {};
  const add = (cue, text) => text && String(text).trim() && (t[cue] = clean(String(text)));
  add("login", w.login);
  String(w.main ?? "").split("|").forEach((line, i) => add(`main_${i + 1}`, line));
  add("touch_head", w.headtouch);
  add("touch_1", w.touch);
  add("touch_2", w.touch2);
  add("mail", w.mail);
  add("home", w.home);
  add("mission_complete", w.mission_complete);
  add("task", w.mission);
  add("expedition", w.expedition);
  add("propose", w.propose);
  add("detail", w.detail);
  add("profile", w.profile);
  return t;
}
/** Bỏ thẻ định dạng và mã thay thế tên (ví dụ {namecode:12}) khỏi phụ đề. */
const clean = (s) => s.replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();

const sets = {};
const work = mkdtempSync(join(tmpdir(), "azl-voice-"));
try {
  for (const key of keys) {
    const src = join(CACHE, "ClientAssets", client, "AssetBundles", "cue", `cv-${key}.b`);
    if (!existsSync(src)) {
      console.warn(`! thiếu gói cv-${key}.b`);
      continue;
    }
    const acb = join(work, `cv-${key}.acb`); // vgmstream nhận dạng ACB theo đuôi file
    copyFileSync(src, acb);
    const head = sh("vgmstream-cli", ["-m", acb]);
    const count = Number(/stream count: (\d+)/.exec(head.stdout)?.[1] ?? 0);
    if (!count) {
      console.warn(`! cv-${key}: vgmstream không đọc được (${(head.stderr || head.stdout).split("\n")[0]})`);
      continue;
    }
    const wantText = cueTexts(keyWords[key]);
    const lines = {};
    for (let i = 1; i <= count; i++) {
      const name = /stream name: (.+)/.exec(sh("vgmstream-cli", ["-s", String(i), "-m", acb]).stdout)?.[1]?.trim();
      if (!name || !(name in wantText)) continue;
      const dest = join(OUT_DIR, key, `${name}.webm`);
      if (force || !existsSync(dest)) {
        mkdirSync(dirname(dest), { recursive: true });
        const wav = join(work, `${key}-${name}.wav`);
        if (sh("vgmstream-cli", ["-s", String(i), "-o", wav, acb]).status !== 0) {
          console.warn(`! cv-${key}/${name}: giải mã lỗi`);
          continue;
        }
        const enc = sh("ffmpeg", ["-v", "error", "-y", "-i", wav, "-ac", "1", "-c:a", "libopus", "-b:a", "56k", dest]);
        rmSync(wav, { force: true });
        if (enc.status !== 0) {
          console.warn(`! cv-${key}/${name}: ffmpeg lỗi`);
          continue;
        }
      }
      lines[name] = { src: `/assets/azurlane/voice/${key}/${name}.webm`, text: wantText[name] };
    }
    sets[key] = lines;
    console.log(`  cv-${key}: ${Object.keys(lines).length} câu`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

// 4. dữ liệu
mkdirSync(dirname(OUT_DATA), { recursive: true });
writeFileSync(OUT_DATA, JSON.stringify({ bundles: bundleKey, sets }) + "\n");
console.log(`Đã ghi ${Object.keys(sets).length} bộ voice → data/azurlane.voice.local.json`);
