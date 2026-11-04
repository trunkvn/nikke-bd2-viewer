#!/usr/bin/env node
/**
 * Chia sẻ app tạm thời qua Cloudflare Quick Tunnel (https://xxxx.trycloudflare.com) cho vài người xem.
 *
 *   node scripts/share.mjs                    # build + chạy bản production + mật khẩu ngẫu nhiên + tunnel
 *   node scripts/share.mjs --password abc123  # tự đặt mật khẩu
 *   node scripts/share.mjs --skip-build       # dùng bản build hiện có (nhanh hơn)
 *   node scripts/share.mjs --no-password      # KHÔNG khuyến khích: ai có link đều xem được
 *
 * Cách hoạt động:  trình duyệt → Cloudflare → cloudflared → [proxy có mật khẩu :PORT+1] → [next start :PORT]
 *  - Chạy bản production (không phải `pnpm dev`) ở cổng riêng, chỉ lắng nghe 127.0.0.1; dev server của bạn không bị đụng tới.
 *  - Proxy yêu cầu HTTP Basic Auth (tên đăng nhập tuỳ ý, mật khẩu như được in ra) cho MỌI request, kể cả asset.
 *    Sai quá nhiều lần từ một địa chỉ thì bị khoá tạm thời.
 *  - Nhấn Ctrl+C để dừng: tunnel đóng và link chết ngay.
 *
 * Lưu ý bản quyền: public/assets chứa asset game (Spine, ảnh, voice) thuộc Shift Up / Level Infinite và diễn viên lồng
 * tiếng. Chỉ chia sẻ cho người bạn tin tưởng, trong thời gian ngắn, rồi tắt.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);

const APP_PORT = Number(opt("port", 3777));
const PROXY_PORT = APP_PORT + 1;
const HOST = "127.0.0.1";

// ───────── mật khẩu ─────────
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // bỏ các ký tự dễ nhầm (i, l, o, 0, 1)
const randomPassword = (n = 10) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const usePassword = !flag("no-password");
const password = usePassword ? (opt("password") ?? randomPassword()) : null;
const sha = (s) => createHash("sha256").update(s).digest();

const children = [];
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\nĐang dừng tunnel và server...");
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {}
  }
  setTimeout(() => process.exit(code), 800);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// ───────── 0. cloudflared ─────────
if (spawnSync("cloudflared", ["--version"], { stdio: "ignore" }).status !== 0) {
  console.error("Không tìm thấy cloudflared. Cài bằng: brew install cloudflared");
  process.exit(1);
}

// ───────── 1. build ─────────
if (!flag("skip-build")) {
  console.log("Build bản production (dùng --skip-build để bỏ qua)...");
  const b = spawnSync("pnpm", ["build"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) {
    console.error("Build lỗi, dừng.");
    process.exit(1);
  }
}

// ───────── 2. next start (chỉ nghe 127.0.0.1) ─────────
const app = spawn("pnpm", ["exec", "next", "start", "-p", String(APP_PORT), "-H", HOST], {
  cwd: ROOT,
  stdio: ["ignore", "ignore", "inherit"],
});
children.push(app);
app.on("exit", (code) => {
  if (!stopping) {
    console.error(`next start thoát bất ngờ (mã ${code}).`);
    shutdown(1);
  }
});

async function waitFor(url, ms = 40000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}
if (!(await waitFor(`http://${HOST}:${APP_PORT}/`))) {
  console.error(`next start không phản hồi ở cổng ${APP_PORT} (có thể cổng đang bị chiếm, thử --port 3800).`);
  shutdown(1);
  await new Promise(() => {});
}

// ───────── 3. proxy có mật khẩu ─────────
const MAX_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;
const fails = new Map(); // ip -> { n, until }
const clientIp = (req) => String(req.headers["cf-connecting-ip"] ?? req.socket.remoteAddress ?? "?");

function authorized(req) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const given = decoded.slice(decoded.indexOf(":") + 1); // bỏ phần tên đăng nhập
  return timingSafeEqual(sha(given), sha(password));
}

const proxy = http.createServer(async (req, res) => {
  if (usePassword) {
    const ip = clientIp(req);
    const f = fails.get(ip);
    if (f && f.until > Date.now()) {
      res.writeHead(429, { "Retry-After": "600" }).end("Too many attempts. Try again later.");
      return;
    }
    if (!authorized(req)) {
      const rec = f && f.until === 0 ? f : { n: 0, until: 0 };
      if (req.headers.authorization) {
        rec.n++;
        if (rec.n >= MAX_FAILS) {
          rec.until = Date.now() + LOCK_MS;
          rec.n = 0;
          console.log(`[auth] khoá ${ip} 10 phút (sai mật khẩu ${MAX_FAILS} lần)`);
        } else {
          console.log(`[auth] sai mật khẩu từ ${ip} (${rec.n}/${MAX_FAILS})`);
        }
        fails.set(ip, rec);
        await new Promise((r) => setTimeout(r, 400)); // làm chậm việc dò mật khẩu
      }
      res
        .writeHead(401, { "WWW-Authenticate": 'Basic realm="NIKKE Viewer (private)", charset="UTF-8"', "Content-Type": "text/plain" })
        .end("Authentication required");
      return;
    }
    fails.delete(ip);
  }

  const headers = { ...req.headers, host: `${HOST}:${APP_PORT}` };
  delete headers.authorization; // không chuyển mật khẩu xuống app
  const upstream = http.request(
    { host: HOST, port: APP_PORT, method: req.method, path: req.url, headers },
    (up) => {
      const out = { ...up.headers };
      // Asset game nặng: cho trình duyệt của người xem cache để họ không phải tải lại (và không dồn băng thông của bạn).
      if (req.url?.startsWith("/assets/")) out["cache-control"] = "private, max-age=3600";
      res.writeHead(up.statusCode ?? 502, out);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad gateway");
  });
  req.pipe(upstream);
});
await new Promise((resolve) => proxy.listen(PROXY_PORT, HOST, resolve));
children.push({ kill: () => proxy.close() });

// ───────── 4. cloudflared ─────────
function startTunnel(extraArgs = []) {
  return new Promise((resolve) => {
    const t = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://${HOST}:${PROXY_PORT}`, ...extraArgs], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(t);
    let found = false;
    const onData = (buf) => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(buf.toString());
      if (m && !found) {
        found = true;
        resolve({ url: m[0], proc: t });
      }
    };
    t.stdout.on("data", onData);
    t.stderr.on("data", onData);
    t.on("exit", (code) => {
      if (!found) resolve(null);
      else if (!stopping) {
        console.error(`\ncloudflared thoát (mã ${code}): link đã chết.`);
        shutdown(1);
      }
    });
    setTimeout(() => {
      if (!found) {
        try {
          t.kill("SIGTERM");
        } catch {}
        resolve(null);
      }
    }, 30000);
  });
}

console.log("Mở tunnel Cloudflare...");
let tunnel = await startTunnel();
if (!tunnel) {
  console.log("Thử lại bằng giao thức http2 (một số mạng chặn QUIC)...");
  tunnel = await startTunnel(["--protocol", "http2"]);
}
if (!tunnel) {
  console.error("Không mở được tunnel. Kiểm tra mạng rồi thử lại.");
  shutdown(1);
  await new Promise(() => {});
}

const line = "─".repeat(64);
console.log(`\n${line}`);
console.log("  LINK CHIA SẺ:  " + tunnel.url);
if (usePassword) {
  console.log("  Tên đăng nhập: (gõ gì cũng được)");
  console.log("  Mật khẩu:      " + password);
} else {
  console.log("  ⚠ KHÔNG có mật khẩu: bất kỳ ai có link đều xem được asset game.");
}
console.log(line);
console.log("  Link có thể mất vài giây mới truy cập được. Ctrl+C để dừng và đóng link.\n");
