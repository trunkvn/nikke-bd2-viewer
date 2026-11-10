import { AwsClient } from "aws4fetch";

/**
 * Asset game nằm trong một bucket Cloudflare R2 RIÊNG TƯ thay vì public/assets trên đĩa. Bucket không công khai: mọi yêu cầu tới R2
 * đều được ký bằng khoá API đặt trong .env.local (chỉ đọc phía server, không có tiền tố NEXT_PUBLIC nên không bao giờ xuống trình duyệt).
 *
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   R2_ENDPOINT (tuỳ chọn, mặc định https://<account>.r2.cloudflarestorage.com; dùng để trỏ tới máy chủ giả khi thử)
 *
 * Không đặt các biến này thì mọi thứ vẫn chạy như cũ với file trong public/assets.
 */
export type R2Config = { client: AwsClient; base: string };

let cached: R2Config | null | undefined;

export function getR2(): R2Config | null {
  if (cached !== undefined) return cached;
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket, R2_ENDPOINT: endpoint } = process.env;
  if (!accessKeyId || !secretAccessKey || !bucket || (!account && !endpoint)) return (cached = null);
  const host = (endpoint ?? `https://${account}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  return (cached = {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    base: `${host}/${encodeURIComponent(bucket)}`,
  });
}

/** URL của một object trong bucket; `key` là chuỗi đã tách theo "/" (mỗi đoạn được mã hoá riêng). */
export const objectUrl = (cfg: R2Config, segments: string[]) => `${cfg.base}/${segments.map(encodeURIComponent).join("/")}`;
