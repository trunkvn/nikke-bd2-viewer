import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AzurShip } from "./azurlaneShared";

export { toAzurCard } from "./azurlaneShared";
export type { AzurCard, AzurShip, AzurSkin } from "./azurlaneShared";

/** Đọc data/azurlane.local.json (do scripts/fetch-azurlane.mjs sinh ra); chỉ dùng phía server. */
function loadAll(): AzurShip[] {
  const file = join(process.cwd(), "data", "azurlane.local.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as AzurShip[]) : [];
}

// Production: đọc một lần. Dev: đọc lại mỗi lần để thấy ngay dữ liệu vừa sinh.
let cache: AzurShip[] | null = null;
export function getAllShips(): AzurShip[] {
  if (process.env.NODE_ENV !== "production") return loadAll();
  return (cache ??= loadAll());
}

export const getShipBySlug = (slug: string) => getAllShips().find((s) => s.slug === slug);
