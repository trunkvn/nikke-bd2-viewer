import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Character, CharacterSkills, CutsceneSequence, Game } from "@/data/types";
import { loadVoice, loadVoiceAt } from "./voice";

/** Đọc một file dữ liệu local; chưa có file thì danh sách trống. */
function readLocal(name: string): Character[] {
  const file = join(process.cwd(), "data", name);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Character[]) : [];
}

/**
 * Dữ liệu do các script fetch sinh ra (asset cộng đồng, chỉ dùng local, đã gitignore):
 *  - data/nikke.local.json ← scripts/fetch-nikke.mjs (kèm voice và kỹ năng)
 *  - data/bd2.local.json   ← scripts/fetch-bd2.mjs
 * Chưa có file thì game đó không có nhân vật nào.
 */
function loadAll(): Character[] {
  const skills = loadSkills();
  const nikke = readLocal("nikke.local.json").map((c) => ({ ...c, voice: loadVoice(c), skills: skills[c.id] }));
  const sequences = loadSequences();
  const bd2 = readLocal("bd2.local.json").map((c) => ({
    ...c,
    skins: c.skins.map((s) => {
      const id = s.cutscene && /cutscene_char(\d+)\.skel/.exec(s.cutscene.skel)?.[1];
      const seq = id ? sequences[id] : undefined;
      return {
        ...s,
        voice: loadVoiceAt(`bd2/${c.slug}/${s.id}`),
        ...(s.cutscene && seq ? { cutscene: { ...s.cutscene, sequences: seq } } : {}),
      };
    }),
  }));
  return [...nikke, ...bd2];
}

/** data/bd2.sequences.local.json do `scripts/fetch-bd2-sequences.mjs` sinh ra (khoá theo số trong tên skeleton); không có thì Ultimate tự lập kế hoạch. */
function loadSequences(): Record<string, CutsceneSequence[]> {
  const file = join(process.cwd(), "data", "bd2.sequences.local.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, CutsceneSequence[]>) : {};
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
