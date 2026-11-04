import type { Character, Rarity } from "@/data/types";

/**
 * Dữ liệu tối thiểu để vẽ thẻ nhân vật trong gallery và lọc/tìm kiếm.
 * Gửi xuống trình duyệt thay cho `Character` đầy đủ (mô tả, danh sách skin, đường dẫn Spine, voice...)
 * để payload của trang chủ nhỏ đi nhiều lần.
 */
export type CardData = {
  id: string;
  slug: string;
  name: string;
  rarity?: Rarity;
  class?: string;
  element?: string;
  manufacturer?: string;
  weapon?: string;
  tags: string[];
  thumb: string;
  skinCount: number;
  hasSpine: boolean;
};

/** Số thẻ dựng ban đầu (cả phía server lẫn client); cuộn xuống thì dựng thêm theo từng đợt cùng cỡ. */
export const GALLERY_CHUNK = 48;

export function toCard(c: Character): CardData {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    rarity: c.rarity,
    class: c.class,
    element: c.element,
    manufacturer: c.manufacturer,
    weapon: c.weapon,
    tags: c.tags,
    thumb: c.skins[0]?.thumb ?? "",
    skinCount: c.skins.length,
    hasSpine: c.skins.some((s) => s.render.kind === "spine"),
  };
}
