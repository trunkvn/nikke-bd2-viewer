import { getR2, objectUrl } from "@/lib/r2";

/**
 * Phục vụ /assets/* từ bucket R2 riêng tư. File có trong public/assets thì Next trả thẳng từ đĩa và route này không được gọi; chỉ khi
 * file không còn ở đĩa (hoặc bạn đã chuyển hết lên R2) yêu cầu mới tới đây. Không cấu hình R2 thì trả 404 như một file không tồn tại.
 *
 * Đi qua máy chủ Next (không chuyển hướng tới URL ký sẵn) vì Spine nạp atlas rồi tự ghép tên trang texture theo đường dẫn tương đối,
 * chữ ký trong query sẽ làm hỏng cách đó, và để khoá R2 không bao giờ ra khỏi máy chủ. Hỗ trợ Range (âm thanh, tua) và ETag.
 */

const TYPES: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webm: "audio/webm",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  json: "application/json",
  atlas: "text/plain; charset=utf-8",
  skel: "application/octet-stream",
};
const PASS = ["content-length", "content-range", "accept-ranges", "etag", "last-modified"] as const;

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

async function serve(req: Request, ctx: RouteContext<"/assets/[...path]">, method: "GET" | "HEAD") {
  const cfg = getR2();
  if (!cfg) return notFound();

  const { path } = await ctx.params;
  // Mỗi đoạn đường dẫn: không rỗng, không "." / "..", không chứa dấu gạch chéo hay ký tự điều khiển.
  if (!path.length || path.some((s) => !s || s === "." || s === ".." || /[/\\\0]/.test(s))) return notFound();

  const headers = new Headers();
  for (const h of ["range", "if-none-match", "if-modified-since"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  let upstream: Response;
  try {
    upstream = await cfg.client.fetch(objectUrl(cfg, ["assets", ...path]), { method, headers });
  } catch {
    return new Response("Storage unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  if (upstream.status === 404 || upstream.status === 403) return notFound();
  if (upstream.status >= 500 || (upstream.status >= 400 && upstream.status !== 416)) return new Response("Storage error", { status: 502, headers: { "Cache-Control": "no-store" } });

  const out = new Headers();
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  const ext = path[path.length - 1].split(".").pop()?.toLowerCase() ?? "";
  out.set("Content-Type", TYPES[ext] ?? upstream.headers.get("content-type") ?? "application/octet-stream");
  out.set("X-Content-Type-Options", "nosniff");
  // Chỉ cho phép trình duyệt của chính người dùng lưu đệm (không phải CDN/proxy trung gian), đủ lâu để lần xem sau không phải tải lại.
  out.set("Cache-Control", upstream.status === 416 ? "no-store" : "private, max-age=86400, stale-while-revalidate=604800");
  // 304 và 416 không có thân; không chuyển tiếp thân của R2 (là XML báo lỗi) cho các trạng thái đó.
  const bodyless = method === "HEAD" || upstream.status === 304 || upstream.status === 416;
  return new Response(bodyless ? null : upstream.body, { status: upstream.status, headers: out });
}

export const GET = (req: Request, ctx: RouteContext<"/assets/[...path]">) => serve(req, ctx, "GET");
export const HEAD = (req: Request, ctx: RouteContext<"/assets/[...path]">) => serve(req, ctx, "HEAD");
