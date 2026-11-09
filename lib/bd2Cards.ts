import type { Character, SpineRender } from "@/data/types";

/** Phần dữ liệu một thẻ nhân vật Brown Dust 2 trong gallery (nhẹ, để gửi xuống client). */
export type Bd2Card = {
  slug: string;
  name: string;
  stars?: number;
  /** Ảnh thẻ: trang phục mới nhất (nếu biết ngày ra mắt), không thì trang phục đầu tiên. */
  thumb: string;
  /** Tên trang phục đang làm ảnh thẻ. */
  costume: string;
  costumes: number;
  /** Tên mọi trang phục, để tìm kiếm. */
  costumeNames: string[];
  /** Ngày ra mắt của trang phục mới nhất (ISO) hoặc "" nếu không biết, để sắp xếp theo mới nhất. */
  latest: string;
  /** Có trang phục nào có Ultimate (cutscene kỹ năng) / Fated Guest không, để lọc và dán nhãn. */
  hasUltimate: boolean;
  hasDating: boolean;
  /** Model Spine của trang phục làm ảnh thẻ, để xem trước khi rê chuột vào thẻ. */
  preview?: SpineRender;
};

/** Trang phục mặc định của nhân vật: mới ra mắt nhất nếu biết ngày, không thì trang phục đầu tiên. */
export function bd2DefaultSkin(c: Character) {
  const dated = c.skins.filter((s) => s.released).sort((a, b) => b.released!.localeCompare(a.released!));
  return dated[0] ?? c.skins[0];
}

export function toBd2Card(c: Character): Bd2Card {
  const dated = c.skins.filter((s) => s.released).sort((a, b) => b.released!.localeCompare(a.released!));
  const cover = bd2DefaultSkin(c);
  return {
    slug: c.slug,
    name: c.name,
    stars: c.stars,
    thumb: cover.thumb,
    costume: cover.name,
    costumes: c.skins.length,
    costumeNames: c.skins.map((s) => s.name),
    latest: dated[0]?.released ?? "",
    hasUltimate: c.skins.some((s) => !!s.cutscene),
    hasDating: c.skins.some((s) => !!s.dating),
    preview: cover.render.kind === "spine" ? cover.render : undefined,
  };
}
