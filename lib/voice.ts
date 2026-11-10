import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Character, Voice, VoiceSet } from "@/data/types";

const AUDIO_EXT = /\.(mp3|ogg|wav|m4a|aac|webm)$/i;
const LANG_DIR = /^[a-z]{2}$/;

/**
 * Giọng nói được phát hiện theo QUY ƯỚC THƯ MỤC/TÊN FILE, không cần sửa JSON:
 *
 *   public/assets/<game>/<id>/voice/<lang>/
 *     enter_1.wav, enter_2.wav ...   câu chào khi vào xem / đổi sang nhân vật này
 *     touch_1.wav, touch_2.wav ...   câu nói khi nhấp vào nhân vật
 *     captions.json                  (tuỳ chọn) { "touch_1.wav": "Phụ đề hiển thị khi nói" }
 *
 * <lang> là mã 2 chữ cái (en, ja, ko, zh...). <id> là phần sau tiền tố game của id nhân vật
 * (ví dụ "nikke-c010" → "c010"). Mỗi tình huống có nhiều file thì chọn ngẫu nhiên.
 * Chỉ chạy phía server (đọc đĩa lúc render); thêm file mới xong cần tải lại trang.
 */
export function loadVoice(character: Pick<Character, "id" | "game">): Voice | undefined {
  const key = character.id.replace(/^[a-z0-9]+-/i, "");
  return loadVoiceAt(`${character.game}/${key}`);
}

/**
 * Giọng nói của MỘT trang phục (Brown Dust 2): public/assets/bd2/<nhân vật>/<trang phục>/voice/<lang>/touch_N.webm.
 * `path` là đường dẫn dưới public/assets, ví dụ "bd2/alec/sword-breaker".
 */
export function loadVoiceAt(path: string): Voice | undefined {
  const root = join(process.cwd(), "public", "assets", ...path.split("/"), "voice");
  if (!existsSync(root)) return undefined;
  const game = path;

  const voice: Voice = {};
  for (const lang of readdirSync(root).sort()) {
    const dir = join(root, lang);
    if (!LANG_DIR.test(lang) || !statSync(dir).isDirectory()) continue;
    const set = loadSet(dir, `/assets/${game}/voice/${lang}`);
    // Brown Dust 2 chỉ có các câu "BattleReady" (đều là câu chào khi sẵn sàng): câu đầu tiên làm lời chào khi vào trang,
    // vẫn nằm trong nhóm câu nói khi nhấp.
    if (set && !set.enter && set.touch?.length && path.startsWith("bd2/")) set.enter = [set.touch[0]];
    if (set) voice[lang] = set;
  }
  return Object.keys(voice).length ? voice : undefined;
}

function loadSet(dir: string, urlBase: string): VoiceSet | undefined {
  let captions: Record<string, string> = {};
  const captionFile = join(dir, "captions.json");
  if (existsSync(captionFile)) {
    try {
      captions = JSON.parse(readFileSync(captionFile, "utf8"));
    } catch {
      console.warn(`[voice] captions.json không hợp lệ: ${captionFile}`);
    }
  }

  const set: VoiceSet = {};
  for (const file of readdirSync(dir).sort()) {
    if (!AUDIO_EXT.test(file)) continue;
    const trigger = /^(enter|touch)/i.exec(file)?.[1].toLowerCase() as "enter" | "touch" | undefined;
    if (!trigger) continue;
    (set[trigger] ??= []).push({ src: `${urlBase}/${encodeURIComponent(file)}`, text: captions[file] });
  }
  return set.enter || set.touch ? set : undefined;
}
