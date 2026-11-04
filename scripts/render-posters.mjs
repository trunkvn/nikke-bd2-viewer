#!/usr/bin/env node
/**
 * Render thumbnail (nửa người, nền trong suốt, WebP 480x640) cho từng skin Spine bằng Chrome headless.
 * Icon gốc của game chỉ 128x128 nên phóng lên card bị mờ; poster render từ chính Spine thì sắc nét.
 *
 *   node scripts/render-posters.mjs            # mọi skin trong data/nikke.local.json còn thiếu thumb.png
 *   node scripts/render-posters.mjs --force    # render lại tất cả
 *
 * Cần Chrome/Chromium (đặt CHROME_PATH nếu không ở vị trí mặc định).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_JSON = join(ROOT, "data", "nikke.local.json");
export const THUMB_W = 480;
export const THUMB_H = 640;
const THUMB_FILE = "thumb.webp";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".atlas": "text/plain; charset=utf-8",
  ".skel": "application/octet-stream",
};

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((p) => p && existsSync(p));
}

function freePort() {
  return new Promise((resolve) => {
    const s = createNetServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chỉ phục vụ đúng 3 nguồn cần thiết (trang poster, runtime Spine, asset nikke), bind localhost. */
function resolveRequest(urlPath) {
  if (urlPath === "/poster.html") return join(ROOT, "scripts", "poster.html");
  if (/^\/node_modules\/spine-webgl-4[01]\/dist\/iife\/spine-webgl\.js$/.test(urlPath)) return join(ROOT, urlPath);
  if (urlPath.startsWith("/assets/nikke/")) {
    const file = normalize(join(ROOT, "public", urlPath));
    return file.startsWith(join(ROOT, "public", "assets", "nikke")) ? file : null;
  }
  return null;
}

function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = resolveRequest(urlPath);
    if (!file || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/**
 * @param {{skinId:string, version:string, skel:string, atlas:string}[]} items  skel/atlas là đường dẫn URL (/assets/...)
 * @returns {Promise<Set<string>>} các skinId render thành công
 */
export async function renderPosters(items, { force = false } = {}) {
  const ok = new Set();
  const todo = items.filter((i) => force || !existsSync(join(ROOT, "public", "assets", "nikke", i.skinId, THUMB_FILE)));
  for (const i of items) if (!todo.includes(i)) ok.add(i.skinId);
  if (todo.length === 0) return ok;

  const chromePath = findChrome();
  if (!chromePath) {
    console.error("! Không tìm thấy Chrome/Chromium (đặt CHROME_PATH), bỏ qua render thumbnail.");
    return ok;
  }

  const server = await startServer();
  const appPort = server.address().port;
  const debugPort = await freePort();
  const profile = join(ROOT, "node_modules", ".cache", "poster-chrome-profile");
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      try {
        target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === "page");
      } catch {}
      if (!target) await sleep(200);
    }
    if (!target) throw new Error("không kết nối được Chrome");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
    let n = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) {
        pending.get(d.id)(d);
        pending.delete(d.id);
      }
    };
    const send = (method, params = {}) =>
      new Promise((res) => {
        const id = ++n;
        pending.set(id, res);
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evalJs = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: THUMB_W, height: THUMB_H, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });

    for (const item of todo) {
      const qs = new URLSearchParams({
        v: item.version,
        skel: item.skel,
        atlas: item.atlas,
        w: String(THUMB_W),
        h: String(THUMB_H),
        mode: "bust",
      });
      if (item.spineSkin) qs.set("spineSkin", item.spineSkin);
      await send("Page.navigate", { url: `http://127.0.0.1:${appPort}/poster.html?${qs}` });
      let done = false;
      for (let i = 0; i < 150 && !done; i++) {
        await sleep(100);
        const err = await evalJs("window.__error");
        if (err) {
          console.error(`  ! ${item.skinId}: ${err}`);
          break;
        }
        done = (await evalJs("window.__done === true")) === true;
      }
      if (!done) continue;
      await sleep(250); // chờ vài frame vẽ
      const shot = await send("Page.captureScreenshot", {
        format: "webp",
        quality: 88,
        clip: { x: 0, y: 0, width: THUMB_W, height: THUMB_H, scale: 1 },
      });
      const dir = join(ROOT, "public", "assets", "nikke", item.skinId);
      writeFileSync(join(dir, THUMB_FILE), Buffer.from(shot.result.data, "base64"));
      rmSync(join(dir, "thumb.png"), { force: true }); // bản PNG cũ (600x800, nặng)
      ok.add(item.skinId);
      console.log(`  ✓ thumb ${item.skinId}`);
    }
    ws.close();
  } finally {
    chrome.kill();
    server.close();
  }
  return ok;
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(LOCAL_JSON)) {
    console.error("Chưa có data/nikke.local.json — chạy scripts/fetch-nikke.mjs trước.");
    process.exit(1);
  }
  const characters = JSON.parse(readFileSync(LOCAL_JSON, "utf8"));
  const items = characters.flatMap((c) =>
    c.skins
      .filter((s) => s.render.kind === "spine")
      .map((s) => ({ skinId: s.id, version: s.render.version, skel: s.render.skel, atlas: s.render.atlas, spineSkin: s.render.spineSkin })),
  );
  const ok = await renderPosters(items, { force: process.argv.includes("--force") });
  let changed = false;
  for (const c of characters)
    for (const s of c.skins)
      if (ok.has(s.id) && s.thumb !== `/assets/nikke/${s.id}/${THUMB_FILE}`) {
        s.thumb = `/assets/nikke/${s.id}/${THUMB_FILE}`;
        changed = true;
      }
  if (changed) writeFileSync(LOCAL_JSON, JSON.stringify(characters, null, 2) + "\n");
  console.log(`Xong: ${ok.size}/${items.length} thumbnail.`);
}
