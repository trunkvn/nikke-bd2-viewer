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
  /** Voice theo tên cue (login, main_1, touch_1...), kèm phụ đề tiếng Anh. Không có thì skin không có voice. */
  voice?: Record<string, VoiceLine>;
};

export type VoiceLine = { src: string; text?: string };

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

/**
 * Tách motion thành bộ chuẩn (có ở mọi mô hình, có nhãn) và bộ mở rộng. Skin dạng "cv" có thêm hàng chục motion `idleN`, `touch_idleN`, `touch_dragN`
 * (trạng thái và tương tác riêng của skin đó), nên chúng được gom vào một nhóm thu gọn thay vì phủ kín bảng.
 */
export function splitMotions(names: string[]): { main: string[]; extra: string[] } {
  const ordered = orderMotions(names);
  return { main: ordered.filter((n) => n in LABEL), extra: ordered.filter((n) => !(n in LABEL)) };
}

/** Thứ tự hiển thị các motion: đứng yên, chạm, màn hình chính, còn lại. */
export function orderMotions(names: string[]): string[] {
  const rank = (n: string) => (n === "idle" ? 0 : n.startsWith("touch_") ? 1 : n.startsWith("main_") ? 2 : n === "login" ? 3 : 4);
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Độ hiếm của tàu, từ thấp lên cao. Bốn bậc thường (Normal, Rare, Elite, Super Rare); Ultra Rare là bậc đặc biệt bên trên; Priority và
 * Decisive là tàu "nghiên cứu" (cùng cỡ với Super Rare trở lên). Số sao trong dữ liệu đi theo độ hiếm (Normal/Rare 4, Elite 5, còn lại 6).
 */
export const RARITIES = ["Normal", "Rare", "Elite", "Super Rare", "Priority", "Decisive", "Ultra Rare"] as const;
export const rarityRank = (r: string) => RARITIES.indexOf(r as (typeof RARITIES)[number]);

/** Viết tắt thường dùng trong cộng đồng và màu hiển thị. */
const RARITY_STYLE: Record<string, { abbr: string; color: string }> = {
  Normal: { abbr: "N", color: "#9aa5b1" },
  Rare: { abbr: "R", color: "#5aa9ff" },
  Elite: { abbr: "E", color: "#b88cff" },
  "Super Rare": { abbr: "SR", color: "#ffcf4a" },
  Priority: { abbr: "PR", color: "#ffb347" },
  Decisive: { abbr: "DR", color: "#ff7a59" },
  "Ultra Rare": { abbr: "UR", color: "#ff7ad9" },
};
export const rarityStyle = (r: string) => RARITY_STYLE[r] ?? { abbr: r, color: "#9aa5b1" };

/**
 * Câu thoại ứng với một hoạt cảnh: tên motion Live2D và tên cue voice của game cùng theo loại câu thoại (đăng nhập, màn hình chính, chạm...).
 * Chạm đầu dùng câu "touch_head" nếu có (không thì "touch" thường), chạm người dùng "touch", chạm đặc biệt dùng "touch2"; ghép này suy ra từ tên, chưa đối chiếu từng cái trong game.
 */
const CUES: Record<string, string[]> = {
  login: ["login"],
  home: ["home"],
  touch_head: ["touch_head", "touch_1"],
  touch_body: ["touch_1"],
  touch_special: ["touch_2"],
  mission: ["task"],
  mission_complete: ["mission_complete"],
  complete: ["expedition"],
  mail: ["mail"],
  wedding: ["propose"],
};

/** Câu voice của một motion (undefined nếu motion không có câu thoại hoặc skin không có voice). `main_N` dùng đúng câu thứ N, thiếu thì lấy một câu main khác. */
export function voiceFor(motion: string, voice: Record<string, VoiceLine> | undefined): VoiceLine | undefined {
  if (!voice) return undefined;
  const main = /^main_(\d+)$/.exec(motion);
  if (main) {
    const mains = Object.keys(voice).filter((c) => /^main_\d+$/.test(c));
    return voice[motion] ?? (mains.length ? voice[mains[Math.floor(Math.random() * mains.length)]] : undefined);
  }
  for (const cue of CUES[motion] ?? []) if (voice[cue]) return voice[cue];
  return undefined;
}
