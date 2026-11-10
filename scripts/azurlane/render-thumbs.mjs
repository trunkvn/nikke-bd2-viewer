#!/usr/bin/env node
/**
 * Dựng ảnh thẻ (thumb.webp) từ chính mô hình Live2D cho các skin chưa có ảnh (AzurAPI không có ảnh của skin mới hơn 2/2023).
 * Mở trang tàu trong Chrome không đầu, chọn skin, chờ mô hình vẽ xong, chụp vùng nhân vật rồi cắt 3:4 và nén WebP.
 * Cần một server đang chạy (pnpm dev hoặc pnpm start) và Chrome. Sau đó chạy lại node scripts/fetch-azurlane.mjs để ghi ảnh vào dữ liệu.
 *
 *   node scripts/azurlane/render-thumbs.mjs [--base http://127.0.0.1:3000] [--all]    # mặc định chỉ skin chưa có ảnh
 *   node scripts/azurlane/render-thumbs.mjs --check [--base ...]                        # mở MỌI skin, báo skin nào không vẽ được (không ghi ảnh)
 *
 * Biến môi trường: AZL_CHROME = đường dẫn Chrome (mặc định bản macOS).
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const BASE = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "http://127.0.0.1:3000";
const check = argv.includes("--check");
const all = argv.includes("--all") || check;
const CHROME = process.env.AZL_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9971;
const W = 1440;
const H = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ships = JSON.parse(readFileSync(join(ROOT, "data", "azurlane.local.json"), "utf8"));
const jobs = ships.flatMap((s) => s.skins.filter((k) => all || !k.thumb).map((k) => ({ ship: s, skin: k })));
if (!jobs.length) {
  console.log("Mọi skin đã có ảnh.");
  process.exit(0);
}

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", `--window-size=${W},${H}`, `--user-data-dir=/tmp/azl-thumbs-${Date.now()}`, "about:blank"], { stdio: "ignore" });
try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try {
      tabs = await (await fetch(`http://localhost:${PORT}/json`)).json();
      if (tabs.find((x) => x.type === "page")) break;
    } catch {}
    await sleep(300);
  }
  const ws = new WebSocket(tabs.find((x) => x.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pend = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) {
      pend.get(d.id)(d);
      pend.delete(d.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      pend.set(++id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result.result?.value;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  let failed = 0;
  for (const { ship, skin } of jobs) {
    await send("Page.navigate", { url: `${BASE}/azurlane/characters/${ship.slug}` });
    await sleep(2500);
    for (let i = 0; i < 40 && !(await ev("!!document.querySelector('canvas')")); i++) await sleep(300);
    if (ship.skins.length > 1) await ev(`[...document.querySelectorAll("button[aria-label]")].find(e=>e.getAttribute("aria-label")===${JSON.stringify(skin.name)})?.click()`);
    // Chờ canvas hiện (renderer đặt opacity 1 sau khung hình đầu) hoặc báo lỗi; mô hình lớn (cảnh 8000×5500) có thể mất vài chục giây.
    let state = "timeout";
    for (let i = 0; i < 100; i++) {
      state = await ev(`document.body.innerText.includes("Không tải được Live2D") ? "error" : document.querySelector("[data-viewer] canvas")?.style.opacity === "1" ? "ready" : "loading"`);
      if (state !== "loading") break;
      await sleep(400);
    }
    if (state !== "ready") {
      console.log(`LỖI ${ship.name} / ${skin.name} (${skin.id}): ${state}`);
      failed++;
      continue;
    }
    await sleep(check ? 300 : 2500); // để motion idle chạy được một nhịp rồi mới chụp
    if (check) {
      console.log(`OK   ${ship.name} / ${skin.name}`);
      continue;
    }
    const shot = await send("Page.captureScreenshot", { format: "png" });
    // Vùng nhân vật khi máy tính: bên phải dock (dock rộng ~430px), dưới thanh header và tên.
    const region = { left: 430, top: 70, width: W - 430 - 70, height: H - 70 - 24 };
    const dest = join(ROOT, "public", "assets", "azurlane", skin.id, "thumb.webp");
    await sharp(Buffer.from(shot.result.data, "base64")).extract(region).resize({ width: 480, height: 640, fit: "cover", position: "centre" }).webp({ quality: 85 }).toFile(dest);
    console.log(`Đã dựng ảnh cho ${ship.name} / ${skin.name} → ${skin.id}/thumb.webp`);
  }
  ws.close();
  if (failed) console.log(`${failed} skin không vẽ được.`);
} finally {
  chrome.kill();
}
