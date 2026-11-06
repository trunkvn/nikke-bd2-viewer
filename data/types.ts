export type Game = "nikke" | "bd2";

export type Rarity = "R" | "SR" | "SSR";

/** Cách một skin được vẽ trong viewer. Đổi skin = đổi render. */
export type Render =
  | { kind: "image"; src: string }
  | {
      kind: "spine";
      skel: string;
      atlas: string;
      /** Version Spine của skeleton: runtime phải khớp major.minor. */
      version: "4.0" | "4.1";
      /** Mặc định "idle", nếu không có thì lấy animation đầu tiên. */
      animation?: string;
      /**
       * Tên skin bên trong file Spine. Bỏ trống thì tự chọn: một số skeleton (ví dụ Rapi bản cũ)
       * để skin "default" gần như rỗng và đặt trang phục ở skin có tên như "00", "01".
       */
      spineSkin?: string;
    };

/** Render dạng Spine (tách ra để dùng cho các tư thế). */
export type SpineRender = Extract<Render, { kind: "spine" }>;

/**
 * Tư thế chiến đấu của nhân vật. "stand" (đứng, mặc định) là `Skin.render`; "aim" (ngắm bắn) và "cover" (nấp)
 * là các skeleton Spine riêng với bộ animation riêng.
 */
export type Pose = "stand" | "aim" | "cover";
export const POSES: Pose[] = ["stand", "aim", "cover"];

export type Skin = {
  id: string;
  name: string;
  thumb: string;
  render: Render;
  /** Các tư thế chiến đấu có sẵn của skin này (không phải skin nào cũng có). */
  poses?: Partial<Record<Exclude<Pose, "stand">, SpineRender>>;
};

/** Một câu thoại. `text` (tuỳ chọn) hiện làm phụ đề khi nhân vật nói. */
export type VoiceLine = { src: string; text?: string };

/** Câu thoại theo tình huống: `enter` = khi vào xem/đổi sang nhân vật này, `touch` = khi nhấp vào nhân vật. */
export type VoiceSet = { enter?: VoiceLine[]; touch?: VoiceLine[] };

/** Mã ngôn ngữ 2 chữ cái theo tên thư mục: "en", "ja", "ko", "zh"... */
export type VoiceLang = string;

/** Giọng nói theo từng ngôn ngữ. */
export type Voice = Partial<Record<VoiceLang, VoiceSet>>;

/** Một đoạn chữ trong mô tả kỹ năng; `c` là màu đánh dấu của wiki ("cyan" = hiệu ứng, "orange" = chỉ số chính...). */
export type RichRun = { t: string; c?: string };
/** Mô tả kỹ năng gồm nhiều dòng, mỗi dòng nhiều đoạn chữ. */
export type RichLine = RichRun[];

export type SkillKind = "passive" | "active" | "burst";

export type Skill = {
  name: string;
  kind: SkillKind;
  /** Hồi chiêu (giây); bị động thì không có. */
  cooldown?: number;
  /** Biểu tượng kỹ năng (đã tải về local), nếu có. */
  icon?: string;
  /** Mô tả ở cấp 1. */
  desc: RichLine[];
  /** Giá trị chính theo cấp 1–10, ví dụ "328.86% / 30.37%". */
  levels: string[];
};

export type WeaponInfo = {
  name?: string;
  /** AR, SMG, SG, SR, RL, MG. */
  type?: string;
  /** Dung lượng băng đạn. */
  ammo?: number;
  /** Thời gian nạp đạn (giây). */
  reload?: number;
  control?: string;
  desc: RichLine[];
};

export type CharacterSkills = {
  /** Giai đoạn Burst: "I" | "II" | "III" | "All". */
  burstStage?: string;
  weapon?: WeaponInfo;
  /** Theo thứ tự: kỹ năng 1, kỹ năng 2, Burst. */
  list: Skill[];
};

export type Character = {
  id: string;
  slug: string;
  game: Game;
  name: string;
  /** Metadata có thể thiếu với nhân vật mới chưa tra được; UI tự ẩn phần thiếu. */
  rarity?: Rarity;
  class?: string;
  element?: string;
  manufacturer?: string;
  weapon?: string;
  tags: string[];
  description: string;
  skins: Skin[];
  /** Không lưu trong JSON: lib/voice.ts tự quét thư mục public/assets/<game>/<id>/voice/. */
  voice?: Voice;
  /** Không lưu trong data/nikke.local.json: lib/characters.ts ghép từ data/nikke.skills.local.json (scripts/fetch-skills.mjs). */
  skills?: CharacterSkills;
};
