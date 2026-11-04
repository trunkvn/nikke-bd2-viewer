/**
 * Animation kỹ thuật/nội bộ (khẩu hình, nền, cảnh cắt kỹ năng, bản thử, chuyển tư thế, ngắm theo hướng...),
 * không dành cho người dùng chọn.
 */
const HIDDEN = /^(talk_|bg_|web_|x_|skillcut|waling_test|set$|eye$|void|to_aim$|to_cover$|aim_x$|aim_y$|cover_stun$)/i;
export const isHiddenAnimation = (name: string) => HIDDEN.test(name);

/**
 * Skeleton tư thế chiến đấu (aim/cover) có hàng chục tên rác do họa sĩ để lại ("asdfasdf", "ddd", "test", "12121"...),
 * nên với skeleton loại này chỉ hiện các animation thuộc danh sách cho phép dưới đây.
 * Bỏ cố ý: cover_reload_start/loop/end (các đoạn của cover_reload), *_old, *_before, face_x...
 */
const POSE_SKELETON = /^(aim|cover)_idle/i;
const POSE_ALLOWED = /^(aim|cover)_(idle\d*|fire(_hair|_hip)?|hit\d*|reload|death|skill(_\d+|_fire)?)$/i;

/**
 * Animation chờ lặp mãi: "idle", "idle_02", và của các tư thế chiến đấu: "aim_idle", "cover_idle".
 * Không tính animation kỹ thuật: "bg_idle"/"web_idle" là animation của lớp nền, nếu chọn nhầm làm animation chờ
 * thì nhân vật đứng im.
 */
export const isIdleAnimation = (name: string) => !HIDDEN.test(name) && /(^|_)idle/i.test(name);

/** Chọn animation chờ mặc định của một skeleton: ưu tiên đúng tên "idle", rồi tới các biến thể, cuối cùng là animation đầu tiên. */
export function pickIdleAnimation(names: string[]): string | undefined {
  return (
    names.find((n) => n === "idle") ??
    names.find((n) => /^(aim|cover)_idle$/i.test(n)) ??
    names.find(isIdleAnimation) ??
    names.find((n) => !HIDDEN.test(n)) ??
    names[0]
  );
}

/** Không dùng làm phản ứng ngẫu nhiên khi nhấp vào nhân vật (tư thế ngủ, chiến đấu, di chuyển...). */
const NOT_A_REACTION = /^(idle|battle|sleep|etc|go|panic)|_idle|_death/i;

// Lỗi chính tả/biến thể tên trong dữ liệu gốc.
const ALIASES: Record<string, string> = {
  surp: "surprise",
  surprised: "surprise",
  surpreise: "surprise",
  surprsie: "surprise",
  worried: "worry",
  sorrow: "sad",
};

const LABELS: Record<string, string> = {
  // Tư thế chiến đấu (aim/cover)
  aim_idle: "Ngắm",
  aim_fire: "Bắn",
  aim_fire_hair: "Bắn (hair)",
  aim_fire_hip: "Bắn (hip)",
  aim_hit: "Trúng đạn",
  aim_skill: "Kỹ năng",
  aim_skill_fire: "Kỹ năng (bắn)",
  cover_idle: "Nấp",
  cover_reload: "Nạp đạn",
  cover_hit: "Trúng đạn",
  cover_death: "Gục ngã",
  cover_skill: "Kỹ năng",
  idle: "Đứng yên",
  action: "Hành động",
  expression: "Biểu cảm",
  angry: "Giận dữ",
  rage: "Nổi giận",
  delight: "Vui vẻ",
  happy: "Hạnh phúc",
  smile: "Mỉm cười",
  good: "Hài lòng",
  bad: "Khó chịu",
  shy: "Ngại ngùng",
  no: "Từ chối",
  yes: "Đồng ý",
  think: "Suy nghĩ",
  worry: "Lo lắng",
  sad: "Buồn",
  cry: "Khóc",
  tear: "Rơi lệ",
  surprise: "Bất ngờ",
  pain: "Đau đớn",
  panic: "Hoảng loạn",
  serious: "Nghiêm túc",
  crazy: "Điên cuồng",
  special: "Đặc biệt",
  battle: "Chiến đấu",
  sleep: "Ngủ",
  go: "Xuất phát",
  etc: "Khác",
};

/** Tách "shy_02" → { base: "shy", variant: "2" }; "expression_0" → variant bỏ trống (là bản gốc). */
function parseName(name: string): { base: string; variant: string } {
  const m = /^(.*?)[_-]?(\d+|alt|2)$/i.exec(name);
  const raw = (m ? m[1] : name).toLowerCase();
  const base = ALIASES[raw] ?? raw;
  let variant = m ? m[2].toLowerCase() : "";
  if (variant === "alt") variant = "alt";
  else if (variant) variant = String(Number(variant)); // "02" → "2"
  if (base === "expression" && variant === "0") variant = "";
  return { base, variant };
}

export function animationLabel(name: string): string {
  const { base, variant } = parseName(name);
  const text = LABELS[base] ?? base.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
  return variant ? `${text} ${variant}` : text;
}

/** Danh sách hiển thị cho người dùng: ẩn animation kỹ thuật, idle lên đầu, còn lại giữ thứ tự gốc. */
export function selectableAnimations(names: string[]): string[] {
  const poseSkeleton = names.some((n) => POSE_SKELETON.test(n));
  return names
    .filter((n) => !isHiddenAnimation(n) && (!poseSkeleton || POSE_ALLOWED.test(n)))
    .map((n, i) => ({ n, i }))
    .sort((a, b) => Number(isIdleAnimation(b.n)) - Number(isIdleAnimation(a.n)) || a.i - b.i)
    .map((x) => x.n);
}

/** Phản ứng khi người dùng nhấp vào nhân vật: các biểu cảm/hành động, bỏ tư thế chờ, ngủ, chiến đấu... */
export function reactionAnimations(names: string[]): string[] {
  return selectableAnimations(names).filter((n) => !NOT_A_REACTION.test(n));
}
