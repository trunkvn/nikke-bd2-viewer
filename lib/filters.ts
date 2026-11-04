import type { CardData } from "./cards";

export const FILTER_KEYS = ["rarity", "class", "element", "manufacturer"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export type SortKey = "name" | "rarity";

export type GalleryQuery = {
  q: string;
  sort: SortKey;
  filters: Record<FilterKey, string[]>;
};

const RARITY_ORDER: Record<string, number> = { SSR: 0, SR: 1, R: 2 };
/** Chưa biết độ hiếm thì xếp cuối. */
const rarityRank = (r?: string) => (r ? (RARITY_ORDER[r] ?? 3) : 3);

export function parseQuery(params: URLSearchParams): GalleryQuery {
  const filters = {} as Record<FilterKey, string[]>;
  for (const key of FILTER_KEYS) {
    filters[key] = params.get(key)?.split(",").filter(Boolean) ?? [];
  }
  return {
    q: params.get("q") ?? "",
    sort: params.get("sort") === "rarity" ? "rarity" : "name",
    filters,
  };
}

export function serializeQuery(query: GalleryQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.sort !== "name") params.set("sort", query.sort);
  for (const key of FILTER_KEYS) {
    if (query.filters[key].length) params.set(key, query.filters[key].join(","));
  }
  return params.toString();
}

export function applyQuery(characters: CardData[], query: GalleryQuery): CardData[] {
  const q = query.q.trim().toLowerCase();
  const result = characters.filter((c) => {
    if (q && !`${c.name} ${c.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    return FILTER_KEYS.every((key) => {
      const selected = query.filters[key];
      if (!selected.length) return true;
      const value = c[key];
      return value !== undefined && selected.includes(value);
    });
  });
  return result.sort((a, b) =>
    query.sort === "rarity"
      ? (rarityRank(a.rarity) - rarityRank(b.rarity)) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name),
  );
}

/** Các giá trị có thể chọn cho từng bộ lọc, lấy từ chính dữ liệu. */
export function collectOptions(characters: CardData[]): Record<FilterKey, string[]> {
  const out = {} as Record<FilterKey, string[]>;
  for (const key of FILTER_KEYS) {
    const values = new Set<string>();
    for (const c of characters) {
      const v = c[key];
      if (v) values.add(v);
    }
    out[key] = [...values].sort((a, b) =>
      key === "rarity" ? rarityRank(a) - rarityRank(b) : a.localeCompare(b),
    );
  }
  return out;
}
