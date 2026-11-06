import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Character, CharacterSkills, Game } from "@/data/types";
import { loadVoice } from "./voice";

/**
 * data/nikke.local.json do `scripts/fetch-nikke.mjs` sinh ra (asset cộng đồng, chỉ dùng local, đã gitignore).
 * Chưa có file này thì danh sách trống: chạy `node scripts/fetch-nikke.mjs` để tạo.
 */
function loadAll(): Character[] {
  // Khi thêm Brown Dust 2: đọc thêm data/bd2.local.json và nối vào mảng.
  const file = join(process.cwd(), "data", "nikke.local.json");
  if (!existsSync(file)) return [];
  const local = JSON.parse(readFileSync(file, "utf8")) as Character[];
  const skills = loadSkills();
  return local.map((c) => ({ ...c, voice: loadVoice(c), skills: skills[c.id] }));
}

/** data/nikke.skills.local.json do `scripts/fetch-skills.mjs` sinh ra; không có thì nhân vật không có mục Skills. */
function loadSkills(): Record<string, CharacterSkills> {
  const file = join(process.cwd(), "data", "nikke.skills.local.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, CharacterSkills>) : {};
}

// Production: đọc một lần. Dev: đọc lại mỗi lần để thấy ngay dữ liệu/voice vừa thêm.
let cache: Character[] | null = null;
function all(): Character[] {
  if (process.env.NODE_ENV !== "production") return loadAll();
  return (cache ??= loadAll());
}

export function getAllCharacters(game?: Game): Character[] {
  return game ? all().filter((c) => c.game === game) : all();
}

export function getCharacterBySlug(slug: string, game?: Game): Character | undefined {
  return getAllCharacters(game).find((c) => c.slug === slug);
}
