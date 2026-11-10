/**
 * Kiểu dữ liệu và hàm thuần của Azur Lane (không dùng fs nên import được cả ở component phía trình duyệt). Phần đọc dữ liệu ở lib/azurlane.ts.
 *
 * Azur Lane: mô hình Live2D (Cubism) đã tách ra thư mục model chuẩn. Dữ liệu do `scripts/fetch-azurlane.mjs` sinh ra (data/azurlane.local.json,
 * đã gitignore). Dùng kiểu riêng thay vì `Character` của NIKKE/BD2 vì render là Live2D chứ không phải Spine.
 */
export type AzurSkin = {
  /** Tên bundle, cũng là tên thư mục model: "lafei", "lafei_4"... */
  id: string;
  name: string;
  /** Đường dẫn model3.json (dưới /assets). */
  model: string;
  thumb: string;
  /** Tên các motion (nhóm trong model3.json): idle, touch_head, login... */
  motions: string[];
  hitAreas: string[];
};

export type AzurShip = {
  id: string;
  slug: string;
  name: string;
  names: { en?: string; cn?: string; jp?: string; kr?: string; code?: string };
  nation: string;
  hull: string;
  rarity: string;
  stars?: number;
  skins: AzurSkin[];
};

/** Phần dữ liệu một thẻ trong gallery. */
export type AzurCard = {
  slug: string;
  name: string;
  nation: string;
  hull: string;
  rarity: string;
  stars?: number;
  thumb: string;
  skins: number;
};

export function toAzurCard(s: AzurShip): AzurCard {
  return { slug: s.slug, name: s.name, nation: s.nation, hull: s.hull, rarity: s.rarity, stars: s.stars, thumb: s.skins[0]?.thumb ?? "", skins: s.skins.length };
}


/**
 * Nhãn tiếng Việt cho các motion. Tên motion là của game; ý nghĩa của các nhóm "đoán theo loại câu thoại của tàu trong game" (đăng nhập,
 * màn hình chính, chạm, nhắc nhiệm vụ, hoàn thành, thư, về cảng, lời thề), chưa đối chiếu từng cái trong game.
 */
const LABEL: Record<string, string> = {
  idle: "Đứng yên",
  login: "Đăng nhập",
  home: "Về cảng",
  main_1: "Màn hình chính 1",
  main_2: "Màn hình chính 2",
  main_3: "Màn hình chính 3",
  touch_head: "Chạm đầu",
  touch_body: "Chạm người",
  touch_special: "Chạm đặc biệt",
  mission: "Nhắc nhiệm vụ",
  mission_complete: "Xong nhiệm vụ",
  complete: "Hoàn thành",
  mail: "Thư",
  wedding: "Lời thề",
  effect: "Hiệu ứng",
  gold: "Nhận vàng",
  oil: "Nhận dầu",
  diamond: "Nhận kim cương",
};
export const motionLabel = (name: string) => LABEL[name] ?? name;

/** Thứ tự hiển thị các motion: đứng yên, chạm, màn hình chính, còn lại. */
export function orderMotions(names: string[]): string[] {
  const rank = (n: string) => (n === "idle" ? 0 : n.startsWith("touch_") ? 1 : n.startsWith("main_") ? 2 : n === "login" ? 3 : 4);
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true }));
}
