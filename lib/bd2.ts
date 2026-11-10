import { useSyncExternalStore } from "react";
import type { TapPlan } from "@/components/SpineRenderer";
import { createSetting } from "./createSetting";

/**
 * Animation của mô hình Spine Brown Dust 2 (đã khảo sát trên 205 trang phục):
 *  - `idle`, `motion`: chuyển động toàn thân (có ở mọi mô hình). `_feelingN` (+ `_feelingN_idle`) chỉ có ở một số.
 *  - `_faceN`: chỉ đổi khuôn mặt (mắt, miệng...), chạy ở track chồng lên idle; `_faceN_talk` là bản nhép miệng.
 *  - `_default_F*`, `idle_talk`, `portal`: kỹ thuật/hiếm, không đưa vào giao diện.
 */
export type Bd2Animations = {
  /** Chuyển động toàn thân, theo thứ tự hiển thị. */
  body: { name: string; label: string }[];
  /** Chỉ số các biểu cảm khuôn mặt (từ `_faceN`), tăng dần. */
  faces: number[];
  /** Mô hình có nhép miệng (`_faceN_talk`) cho biểu cảm N hay không. */
  talkFaces: Set<number>;
};

export const faceName = (n: number, talk = false) => `_face${n}${talk ? "_talk" : ""}`;

export function classifyAnimations(names: string[]): Bd2Animations {
  const has = new Set(names);
  const body: Bd2Animations["body"] = [];
  if (has.has("idle")) body.push({ name: "idle", label: "Đứng yên" });
  if (has.has("motion")) body.push({ name: "motion", label: "Chuyển động" });
  for (const n of names) {
    const m = /^_feeling(\d+)$/.exec(n);
    if (m) body.push({ name: n, label: `Cảm xúc ${m[1]}` });
  }
  const faces = names
    .map((n) => /^_face(\d+)$/.exec(n)?.[1])
    .filter((x): x is string => x !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  const talkFaces = new Set(faces.filter((n) => has.has(faceName(n, true))));
  return { body, faces, talkFaces };
}

/**
 * Nhấp vào nhân vật: làm chuyển động `motion` (cử động đặc trưng của mô hình, như viewer gốc), kèm voice. Mô hình không có
 * `motion` thì lấy một chuyển động thân khác. Không chồng biểu cảm ngẫu nhiên lên: `motion` đã có nét mặt riêng, chồng thêm
 * `_faceN` ở track khác dễ làm mắt/miệng lệch hoặc mất.
 */
export const bd2TapPlan = (names: string[], last: string | null): TapPlan | null => {
  const moves = classifyAnimations(names)
    .body.map((b) => b.name)
    .filter((n) => n !== "idle");
  if (moves.includes("motion")) return { body: "motion" };
  const pool = moves.length > 1 ? moves.filter((n) => n !== last) : moves;
  const move = pool[Math.floor(Math.random() * pool.length)];
  return move ? { body: move } : null;
};

// ───────── Ultimate và Fated Guest ─────────

/** Chế độ xem: tư thế đứng (mô hình thường), cutscene kỹ năng (Ultimate), tranh hẹn hò (Fated Guest). */
export type Bd2Category = "character" | "ultimate" | "dating";

export const naturalSort = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/**
 * Fated Guest: skeleton có `idleN` (cảnh nền, lặp) và các `mixN_k[_m]` (phản ứng khi chạm vào chỗ k của cảnh N), chạy chồng lên
 * `idleN` ở track riêng. `others` là animation lẻ không thuộc cảnh nào (ví dụ `loop`).
 */
export type DatingScene = { n: number; idle: string; mixes: string[] };
export function classifyDating(names: string[]): { scenes: DatingScene[]; others: string[] } {
  const scenes = new Map<number, DatingScene>();
  const get = (n: number) => scenes.get(n) ?? scenes.set(n, { n, idle: "", mixes: [] }).get(n)!;
  const others: string[] = [];
  for (const name of [...names].sort(naturalSort)) {
    const idle = /^idle(\d+)$/.exec(name);
    const mix = /^mix(\d+)_/.exec(name);
    if (idle) get(Number(idle[1])).idle = name;
    else if (mix) get(Number(mix[1])).mixes.push(name);
    else others.push(name);
  }
  return { scenes: [...scenes.values()].filter((s) => s.idle || s.mixes.length).sort((a, b) => a.n - b.n), others };
}

/** Tư thế nghỉ của tranh Fated Guest: cảnh `idle1`, rồi animation `loop`, rồi idle đầu tiên có. */
export const datingRest = (names: string[]) =>
  names.find((n) => n === "idle1") ?? names.find((n) => n === "loop") ?? [...names].sort(naturalSort).find((n) => /^idle/.test(n));

// ───────── Nền viewer ─────────

export type Bd2Bg = { id: string; label: string; background: string };

const STARS =
  "radial-gradient(1.5px 1.5px at 12% 18%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 33% 42%, #fff 50%, transparent 51%), radial-gradient(2px 2px at 61% 14%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 78% 36%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 90% 62%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 22% 74%, #fff 50%, transparent 51%)";

/** Các nền dựng sẵn: dịu và trung tính để nhân vật nổi bật; mỗi nền là một giá trị CSS `background`. */
export const BD2_BGS: Bd2Bg[] = [
  {
    id: "sakura",
    label: "Đêm anh đào",
    background:
      "radial-gradient(45% 55% at 36% 62%, rgba(255,160,210,0.32), transparent 72%), radial-gradient(60% 50% at 82% 6%, rgba(120,100,255,0.42), transparent 70%), linear-gradient(180deg, #1a1340 0%, #2b1c4f 100%)",
  },
  {
    id: "slate",
    label: "Than chì",
    background: "radial-gradient(70% 55% at 50% 28%, #2b3042 0%, transparent 72%), linear-gradient(180deg, #1a1d29 0%, #0e1016 100%)",
  },
  {
    id: "mist",
    label: "Sương",
    background: "radial-gradient(70% 55% at 50% 28%, rgba(255,255,255,0.95), transparent 72%), linear-gradient(180deg, #e9edf4 0%, #ccd4e2 100%)",
  },
  {
    id: "paper",
    label: "Giấy",
    background: "radial-gradient(80% 65% at 50% 30%, #fbfbf9 0%, #e9e9e4 100%)",
  },
  {
    id: "mint",
    label: "Bạc hà",
    background: "radial-gradient(70% 55% at 50% 28%, rgba(255,255,255,0.8), transparent 72%), linear-gradient(180deg, #e3f2ed 0%, #bfdcd1 100%)",
  },
  {
    id: "blush",
    label: "Hồng nhạt",
    background: "radial-gradient(70% 55% at 50% 28%, rgba(255,255,255,0.8), transparent 72%), linear-gradient(180deg, #fbeaee 0%, #efc8d4 100%)",
  },
  {
    id: "dusk",
    label: "Hoàng hôn",
    background: "linear-gradient(180deg, #2b2d5c 0%, #6b5b9a 55%, #e8a07a 100%)",
  },
  {
    id: "midnight",
    label: "Nửa đêm",
    background: `${STARS}, radial-gradient(70% 60% at 50% 28%, #2b3254 0%, #0d101c 100%)`,
  },
];

export const BD2_DEFAULT_BG = "sakura";
export const bd2BgSetting = createSetting("bd2-viewer:bg", BD2_DEFAULT_BG);

export const bd2BgOf = (id: string): Bd2Bg => BD2_BGS.find((b) => b.id === id) ?? BD2_BGS[0];

export function cycleBd2Background() {
  const i = BD2_BGS.findIndex((b) => b.id === bd2BgSetting.get());
  bd2BgSetting.set(BD2_BGS[(i + 1) % BD2_BGS.length].id);
}

// ───────── Tự phát cutscene ─────────

/** "off" (mặc định) hoặc "on": vào trang nhân vật có Ultimate thì tự mở tab Ultimate và phát. Mặc định vào tab Nhân vật. Lưu ở localStorage. */
export const bd2CutsceneAutoSetting = createSetting("bd2-viewer:cutscene-auto", "off");

/** [đang bật, đổi trạng thái]. Snapshot phía server là mặc định (tắt) nên không lệch hydration. */
export function useCutsceneAuto(): [boolean, () => void] {
  const on = useSyncExternalStore(
    bd2CutsceneAutoSetting.subscribe,
    () => bd2CutsceneAutoSetting.get() === "on",
    () => false,
  );
  return [on, () => bd2CutsceneAutoSetting.set(on ? "off" : "on")];
}
