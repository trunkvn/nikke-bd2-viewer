import type { PlanStep } from "@/components/SpineRenderer";
import type { CutsceneNode, CutsceneSequence } from "@/data/types";

/**
 * Cutscene kỹ năng của Brown Dust 2: mỗi mô hình Spine có vài animation theo pha (A, B, C...) rồi một animation lặp cuối,
 * cộng các lớp phụ chạy song song (váy, lửa, khói...). Tên đặt rất khác nhau giữa các nhân vật ("cut_A", "A_cut", "cut_1",
 * "1_cut", "B_cut_idle", "loop", "loop_2"...), nên bộ lập kế hoạch này nhận diện theo mẫu tên chứ không dựa vào danh sách cố định.
 */
export type CutscenePhase = { label: string; at: number };
export type CutscenePlan = {
  steps: PlanStep[];
  /** Các pha để hiện trên giao diện; pha cuối (nếu có) là đoạn lặp. */
  phases: CutscenePhase[];
  /** Số pha chính (không tính đoạn lặp cuối): ứng với số ảnh nền. */
  mainPhases: number;
  /** Tổng thời lượng (giây) khi phát MỘT lần: các pha chính rồi đoạn cuối giữ thêm ít nhất vài giây rồi kết thúc. */
  total: number;
};
/** Đoạn cuối (lặp) được giữ tối thiểu chừng này giây trước khi cutscene kết thúc, để người xem kịp nhìn tư thế cuối. */
const MIN_TAIL = 1.6;

const MAIN = [/^(?:.*\/)?cut_([a-z\d])$/i, /^(?:.*\/)?([a-z\d])_cut$/i];
/** Pha có biến thể số ("cut_A_1", "B_cut_2"): các đoạn nối tiếp nếu không có animation chính "cut_A"/"A_cut" cùng mã; nếu có thì là lớp phụ. */
const VARIANT = [/^(?:.*\/)?cut_([a-z])_(\d+)$/i, /^(?:.*\/)?([a-z])_cut_(\d+)$/i];
const variantId = (name: string) => {
  for (const p of VARIANT) {
    const m = p.exec(name);
    if (m) return { letter: m[1].toLowerCase(), id: `${m[1].toLowerCase()}${m[2].padStart(2, "0")}` };
  }
  return null;
};
const IDLE = [/^(?:.*\/)?cut_([a-z\d])_idle$/i, /^(?:.*\/)?([a-z\d])_cut_idle$/i, /^(?:.*\/)?([a-z\d])_loop$/i];
const match = (name: string, patterns: RegExp[]) => {
  for (const p of patterns) {
    const m = p.exec(name);
    if (m) return m[1].toLowerCase();
  }
  return null;
};

/** Thời lượng tối thiểu của một pha để các pha không dồn vào nhau khi animation dài 0 giây. */
const MIN_PHASE = 0.4;

/** Lớp phụ chạy song song với animation chính `m`: các animation bắt đầu bằng "<m>_" (cut_B_skirt, loop_2_fire...). */
export function extrasFor(names: string[], m: string): string[] {
  const isLoop = (n: string) => /^(?:.*\/)?loop(?:_?\d+)?$/i.test(n);
  const phaseIds = new Set<string>();
  for (const n of names) {
    const id = match(n, MAIN);
    const idleId = match(n, IDLE);
    if (id) phaseIds.add(id);
    if (idleId) phaseIds.add(idleId);
  }
  const isPhaseVariant = (n: string) => {
    const v = variantId(n);
    return !!v && !phaseIds.has(v.letter);
  };
  return names.filter((n) => n.startsWith(`${m}_`) && match(n, MAIN) === null && match(n, IDLE) === null && !isPhaseVariant(n) && !isLoop(n));
}

/**
 * Kế hoạch phát RIÊNG một animation (lặp mãi) kèm các lớp phụ của nó ở track ≥ 1, và tắt các lớp phụ còn lại từ lần chọn trước.
 * Dùng khi người xem chọn từng animation trong danh sách Ultimate.
 */
export function singleAnimationPlan(names: string[], name: string): PlanStep[] {
  const extras = extrasFor(names, name);
  const clear = Array.from({ length: Math.max(extras.length, 6) }, (_, i) => ({ at: 0, name: "", track: i + 1 }));
  return [{ at: 0, name, track: 0, loop: true }, ...clear.map((c, i) => (extras[i] ? { at: 0, name: extras[i], track: i + 1, loop: true } : c))];
}

export function planCutscene(names: string[], durations: Record<string, number>): CutscenePlan | null {
  const dur = (n: string) => Math.max(MIN_PHASE, durations[n] ?? 0);

  // Gom theo mã pha: main = animation chính, idle = bản chờ/lặp của pha đó.
  const phases = new Map<string, { main?: string; idle?: string }>();
  for (const n of names) {
    const mainId = match(n, MAIN);
    if (mainId) phases.set(mainId, { ...phases.get(mainId), main: n });
    const idleId = match(n, IDLE);
    if (idleId) phases.set(idleId, { ...phases.get(idleId), idle: n });
  }
  const plainLetters = new Set(phases.keys());
  for (const n of names) {
    const v = variantId(n);
    if (v && !plainLetters.has(v.letter)) phases.set(v.id, { ...phases.get(v.id), main: n });
  }
  const ids = [...phases.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  // Đoạn lặp cuối: loop có chỉ số lớn nhất ("loop_2" thắng "loop"); không có thì bỏ qua.
  const loops = names.filter((n) => /^(?:.*\/)?loop(?:_?\d+)?$/i.test(n));
  const loopNum = (n: string) => Number(/(\d+)$/.exec(n)?.[1] ?? 0);
  const finalLoop = loops.sort((a, b) => loopNum(b) - loopNum(a))[0];

  const extrasOf = (m: string) => extrasFor(names, m);

  if (ids.length === 0 && !finalLoop) {
    // Không nhận diện được: phát animation đầu tiên một lần.
    const only = names.find((n) => /cut/i.test(n)) ?? names[0];
    return only
      ? { steps: [{ at: 0, name: only, track: 0, loop: true }], phases: [{ label: "▶", at: 0 }], mainPhases: 1, total: Math.max(dur(only), MIN_TAIL) + 0.6 }
      : null;
  }

  const steps: PlanStep[] = [];
  const outPhases: CutscenePhase[] = [];
  let t = 0;
  let extraTracks: number[] = [];
  const clearExtras = () => {
    for (const tr of extraTracks) steps.push({ at: t, name: "", track: tr });
    extraTracks = [];
  };
  const startMain = (m: string, loop: boolean) => {
    clearExtras();
    steps.push({ at: t, name: m, track: 0, loop });
    extrasOf(m).forEach((x, i) => {
      steps.push({ at: t, name: x, track: i + 1, loop });
      extraTracks.push(i + 1);
    });
  };

  for (const id of ids) {
    const { main, idle } = phases.get(id)!;
    outPhases.push({ label: id.replace(/^([a-z])0*(\d)/i, "$1$2").toUpperCase(), at: t });
    if (main) {
      startMain(main, false);
      t += dur(main);
      if (idle) {
        steps.push({ at: t, name: idle, track: 0, loop: false });
        t += dur(idle);
      }
    } else if (idle) {
      startMain(idle, false);
      t += dur(idle);
    }
  }
  const mainPhases = outPhases.length;
  let total = t + MIN_TAIL;
  if (!finalLoop) {
    // Không có animation lặp riêng (kết thúc bằng "B_loop"...): lặp đoạn cuối cùng thay vì dừng ở khung cuối.
    const last = [...steps].reverse().find((s) => s.track === 0 && s.name);
    if (last) {
      last.loop = true;
      total = last.at + Math.max(dur(last.name), MIN_TAIL);
    }
  }
  if (finalLoop) {
    outPhases.push({ label: "∞", at: t });
    startMain(finalLoop, true);
    total = t + Math.max(dur(finalLoop), MIN_TAIL);
  }
  return { steps, phases: outPhases, mainPhases, total };
}

/** Chỉ số ảnh nền (0-based) cho thời điểm `elapsed` giây: pha thứ i dùng nền thứ i, đoạn lặp giữ nền của pha chính cuối. */
export function phaseIndexAt(plan: CutscenePlan, elapsed: number): number {
  let idx = 0;
  plan.phases.forEach((p, i) => {
    if (elapsed >= p.at) idx = i;
  });
  return idx;
}

/** Animation làm tư thế nghỉ (đoạn lặp cuối) để đo khung và căn nhân vật trước khi cutscene bắt đầu phát. */
export function restAnimation(names: string[]): string | undefined {
  const plan = planCutscene(names, {});
  const last = [...(plan?.steps ?? [])].reverse().find((s) => s.track === 0 && s.name);
  return last?.name;
}

/** Chỉ số pha (cũng là chỉ số ảnh nền) của một animation theo kế hoạch tự động; không có trong kế hoạch thì là pha đầu. */
export function phaseOfAnimation(plan: CutscenePlan | null, name: string): number {
  const step = plan?.steps.find((s) => s.name === name);
  return plan && step ? Math.min(phaseIndexAt(plan, step.at), Math.max(0, plan.mainPhases - 1)) : 0;
}

// ───────── Chuỗi Ultimate chỉnh tay ─────────

type Segment = { track: number; start: number; duration: number; name: string; loop: boolean; holdUntil?: number };
type Laid = { segs: Segment[]; duration: number; tracks: number };

/**
 * Dàn một nút của chuỗi chỉnh tay thành các đoạn có mốc bắt đầu, thời lượng và track (cùng cách tính với viewer cộng đồng):
 * tuần tự thì cộng dồn thời lượng; song song thì cùng mốc bắt đầu, mỗi nhánh một track riêng, thời lượng là nhánh dài nhất; nhánh `hold`
 * hoặc `loop` được giữ tới hết nhóm. Thời lượng một animation là min(`d`, thời lượng gốc).
 */
function layout(node: CutsceneNode, durations: Record<string, number>, start: number, track: number): Laid {
  if ("a" in node) {
    const native = durations[node.a] ?? 0;
    const duration = node.d && node.d > 0 ? Math.min(node.d, Math.max(native, 0)) || node.d : native;
    const offset = node.o ?? 0;
    return { segs: [{ track, start: start + offset, duration, name: node.a, loop: !!node.l }], duration: Math.max(duration + offset, 0), tracks: 1 };
  }
  if ("s" in node) {
    const segs: Segment[] = [];
    let elapsed = 0;
    let tracks = 1;
    for (const child of node.s) {
      const r = layout(child, durations, start + elapsed, track);
      segs.push(...r.segs);
      elapsed += r.duration;
      tracks = Math.max(tracks, r.tracks);
    }
    return { segs, duration: elapsed, tracks };
  }
  let next = track;
  let duration = 0;
  const branches = node.p.map((child) => {
    const r = layout(child, durations, start, next);
    duration = Math.max(duration, r.duration);
    next += Math.max(r.tracks, 1);
    return { child, r };
  });
  const end = start + duration;
  const segs = branches.flatMap(({ child, r }) =>
    "a" in child && (child.h || child.l) ? r.segs.map((s) => ({ ...s, holdUntil: end })) : r.segs,
  );
  return { segs, duration, tracks: Math.max(next - track, 1) };
}

/**
 * Kế hoạch phát từ một chuỗi chỉnh tay. Animation cuối cùng của track 0 chạy hết bản gốc rồi giữ khung cuối; các track phụ bị tắt khi
 * hết đoạn của chúng (hoặc hết nhóm nếu `hold`/`loop`) để lớp phụ không kẹt lại ở pha sau. Chỉ số pha (cho ảnh nền) suy ra từ TÊN
 * animation bằng bộ lập kế hoạch tự động, vì chuỗi chỉnh tay không nói pha nào dùng ảnh nền nào.
 */
export function buildSequencePlan(sequence: CutsceneSequence, names: string[], durations: Record<string, number>): CutscenePlan {
  const { segs, duration } = layout(sequence.node, durations, 0, 0);
  const sorted = [...segs].sort((a, b) => a.start - b.start || a.track - b.track);
  const steps: PlanStep[] = Array.from({ length: 8 }, (_, i) => ({ at: 0, name: "", track: i + 1 }));
  for (const s of sorted) {
    steps.push({ at: s.start, name: s.name, track: s.track, loop: s.loop });
    if (s.track === 0) continue;
    const end = s.holdUntil ?? s.start + s.duration;
    // Không tắt nếu ngay lúc đó có đoạn khác bắt đầu trên cùng track (nó tự thay thế).
    if (!sorted.some((o) => o !== s && o.track === s.track && o.start >= s.start && o.start <= end + 1e-6)) steps.push({ at: end, name: "", track: s.track });
  }

  const auto = planCutscene(names, durations);
  let idx = 0;
  const firstAt: number[] = [0];
  for (const s of sorted) {
    if (!auto || !auto.steps.some((p) => p.name === s.name)) continue;
    const i = Math.max(idx, phaseOfAnimation(auto, s.name));
    for (let k = idx + 1; k <= i; k++) firstAt[k] = s.start;
    idx = i;
  }
  const phases = firstAt.map((at, i) => ({ label: String(i + 1), at }));
  return { steps, phases, mainPhases: phases.length, total: duration + MIN_TAIL };
}
