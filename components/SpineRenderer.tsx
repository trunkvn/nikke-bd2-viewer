"use client";

import { useEffect, useRef, useState } from "react";
import type { Render } from "@/data/types";
import { isIdleAnimation, pickIdleAnimation, reactionAnimations } from "@/lib/animations";
import { useViewerInsets, useViewerTap, useViewerTransform } from "./ViewerStage";

type SpineRender = Extract<Render, { kind: "spine" }>;
type Runtime = typeof import("spine-webgl-41");

/** Yêu cầu phát một animation; nonce đổi để phát lại cùng animation được. */
export type PlayCommand = {
  /** Tên animation; chuỗi rỗng ("") trên track phụ = tắt lớp chồng đó. */
  name: string;
  nonce: number;
  loop?: boolean;
  /**
   * Track phát. 0 (mặc định) là hành động chính của cơ thể. Track ≥ 1 là lớp chồng lên trên (ví dụ biểu cảm khuôn mặt
   * của Brown Dust 2) và giữ nguyên cho tới khi bị thay hoặc tắt.
   */
  track?: number;
  /**
   * Kế hoạch phát theo thời gian (thay cho `name`/`loop`/`track` khi có): mỗi bước chạy khi tới mốc `at` (giây kể từ lúc
   * nhận lệnh). Dùng cho cutscene kỹ năng, nơi pha chính (track 0) và các lớp phụ (track ≥ 1) phải chạy song song và nối
   * tiếp nhau. `name` rỗng trên track ≥ 1 = tắt lớp đó.
   */
  plan?: PlanStep[];
  /**
   * Dùng cùng `track` ≥ 1: animation nền lặp mãi ở track 0 trong lúc `name` chạy ở track đó. Fated Guest dùng để chạy phản ứng
   * `mixN_k` chồng lên `idleN`. Dựng lại từ tư thế gốc (setup pose) nên không dính trạng thái của animation trước.
   */
  base?: string;
};

export type PlanStep = { at: number; name: string; track: number; loop?: boolean };

/** Phản ứng khi nhấp trúng nhân vật: hành động cơ thể (track 0) và/hoặc biểu cảm tạm thời (track 1). */
export type TapPlan = { body?: string; overlay?: { name: string; ms: number } };

/**
 * Hai bản runtime cài song song (alias trong package.json). Skeleton 4.0.x và 4.1.x
 * không tương thích chéo nên phải nạp đúng bản; import động để chỉ tải bản cần dùng.
 */
async function loadRuntime(version: SpineRender["version"]): Promise<Runtime> {
  if (version === "4.0") return (await import("spine-webgl-40")) as unknown as Runtime;
  return import("spine-webgl-41");
}

function waitForAssets(assets: InstanceType<Runtime["AssetManager"]>, isCancelled: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (isCancelled()) return resolve();
      if (assets.hasErrors()) return reject(new Error(JSON.stringify(assets.getErrors())));
      if (assets.isLoadingComplete()) return resolve();
      setTimeout(tick, 40);
    };
    tick();
  });
}

/**
 * Skin default gần như rỗng thì dùng skin có nhiều attachment nhất (hoặc skin được chỉ định).
 * Skeleton sẽ tự fallback về skin default cho phần còn lại.
 */
function pickSpineSkin(data: InstanceType<Runtime["SkeletonData"]>, wanted?: string) {
  if (wanted) return data.findSkin(wanted) ?? null;
  const base = data.defaultSkin?.getAttachments().length ?? 0;
  let best: (typeof data.skins)[number] | null = null;
  let bestCount = base;
  for (const skin of data.skins) {
    if (skin === data.defaultSkin) continue;
    const count = skin.getAttachments().length;
    if (count > bestCount) {
      best = skin;
      bestCount = count;
    }
  }
  return best;
}

const MIX_SECONDS = 0.2;
const HIT_RADIUS_PX = 4; // vùng đọc quanh điểm nhấp, để dễ trúng các sợi tóc mảnh
const HIT_ALPHA = 24;

export function SpineRenderer({
  render,
  label,
  command,
  onAnimations,
  onPlaying,
  onTouch,
  speaking = false,
  tapPlan,
  pickRest,
  interactive = true,
  onReady,
  quietLoading = false,
  speed = 1,
  hiddenSlots,
  onSlots,
  skinName,
  onSkins,
  fitContent = false,
}: {
  render: SpineRender;
  label: string;
  /** Yêu cầu phát animation từ bên ngoài (thanh chọn animation). */
  command?: PlayCommand | null;
  /** Báo danh sách animation của skeleton ngay khi nạp xong. */
  onAnimations?: (names: string[], durations?: Record<string, number>) => void;
  /** Báo animation đang phát (kể cả khi tự quay về idle). */
  onPlaying?: (name: string) => void;
  /** Báo khi người dùng nhấp trúng nhân vật (cùng lúc nhân vật phản ứng). */
  onTouch?: () => void;
  /** Đang phát giọng nói: nhép miệng bằng animation talk_* trên track riêng. */
  speaking?: boolean;
  /** Chọn animation làm tư thế "nghỉ" ban đầu (cũng là khung dùng để đo và căn nhân vật); mặc định là idle. */
  pickRest?: (names: string[]) => string | undefined;
  /** Tự chọn phản ứng khi nhấp (thay cho mặc định: một animation ngẫu nhiên không phải idle). */
  tapPlan?: (names: string[], last: string | null) => TapPlan | null;
  /** false: lớp đang mờ đi khi chuyển skin/tư thế, không nhận nhấp chuột. */
  interactive?: boolean;
  /** Báo khi khung hình đầu tiên đã vẽ xong (để lớp cũ biết lúc mờ đi). */
  onReady?: () => void;
  /** Không hiện chữ "đang tải" (khi lớp cũ vẫn đang hiển thị phía dưới, chữ sẽ nổi đè lên nhân vật cũ). */
  quietLoading?: boolean;
  /** Tốc độ phát (1 = bình thường). */
  speed?: number;
  /** Tên các slot (lớp) cần ẩn. Ẩn bằng cách đặt alpha slot về 0 sau khi áp animation nên animation không bật lại được. */
  hiddenSlots?: readonly string[];
  /** Báo danh sách tên slot của skeleton khi nạp xong (để làm bảng bật/tắt lớp). */
  onSlots?: (names: string[]) => void;
  /** Đổi skin bên trong file Spine ngay khi đang chạy (không nạp lại); bỏ trống = skin mặc định của render. */
  skinName?: string;
  /** Báo danh sách skin bên trong file Spine khi nạp xong. */
  onSkins?: (names: string[]) => void;
  /**
   * Căn khung theo phần hình thật sự có nội dung thay vì hộp bao của mọi attachment. Tranh Fated Guest bao quanh bằng các mảng
   * đen rất lớn (viền che), nên hộp bao đo theo attachment làm tranh thật chỉ còn bằng cái tem giữa khung đen.
   */
  fitContent?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const transformRef = useViewerTransform();
  const insetsRef = useViewerInsets();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const playRef = useRef<((name: string, loop?: boolean, track?: number, base?: string) => void) | null>(null);
  const planRef = useRef<((steps: PlanStep[]) => void) | null>(null);
  const tapRequest = useRef<{ clientX: number; clientY: number } | null>(null);
  const talkRef = useRef<((on: boolean) => void) | null>(null);
  const speakingRef = useRef(speaking);
  const cbRef = useRef({ onAnimations, onPlaying, onTouch, onReady, tapPlan, pickRest, onSlots, onSkins });
  useEffect(() => {
    cbRef.current = { onAnimations, onPlaying, onTouch, onReady, tapPlan, pickRest, onSlots, onSkins };
  });
  // Các giá trị đọc trong vòng lặp vẽ: đồng bộ qua ref để đổi chúng không phải dựng lại cả renderer.
  const skinRef = useRef<((name: string | undefined) => void) | null>(null);
  const speedRef = useRef(speed);
  const hiddenRef = useRef<readonly string[]>(hiddenSlots ?? []);
  const skinNameRef = useRef(skinName);
  useEffect(() => {
    skinNameRef.current = skinName;
    skinRef.current?.(skinName);
  }, [skinName]);
  useEffect(() => {
    speedRef.current = speed;
    hiddenRef.current = hiddenSlots ?? [];
  }, [speed, hiddenSlots]);
  useEffect(() => {
    speakingRef.current = speaking;
    talkRef.current?.(speaking);
  }, [speaking]);

  const { skel, atlas, version, animation, spineSkin } = render;

  // Nhấp (không kéo) vào nhân vật: ghi nhận, frame kế tiếp sẽ hit-test theo pixel.
  useViewerTap((pt) => {
    if (interactive) tapRequest.current = pt;
  });

  useEffect(() => {
    if (!command) return;
    if (command.plan) planRef.current?.(command.plan);
    else playRef.current?.(command.name, command.loop, command.track, command.base);
  }, [command]);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let dispose = () => {};
    let loseContext = () => {};

    const host = hostRef.current;
    if (!host) return;
    // Canvas tạo mới cho MỖI lần chạy effect. Next giữ trang cũ ở trạng thái ẩn (Activity) rồi chạy lại
    // effect khi quay lại; một canvas đã bị loseContext() thì không thể tạo context mới, chỉ hiện trắng.
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", label);
    canvas.className = "pointer-events-none absolute inset-0 h-full w-full";
    // Mờ dần vào khi khung hình đầu tiên đã vẽ xong (không phải lúc mới mount): chuyển skin/tư thế không bị chớp trống.
    canvas.style.opacity = "0";
    canvas.style.transition = "opacity 220ms ease-out";
    host.appendChild(canvas);

    (async () => {
      try {
        const spine = await loadRuntime(version);
        if (cancelled) return;

        const context = new spine.ManagedWebGLRenderingContext(canvas, {
          alpha: true,
          premultipliedAlpha: true,
        });
        const gl = context.gl;
        loseContext = () => gl.getExtension("WEBGL_lose_context")?.loseContext();
        const assets = new spine.AssetManager(context, "");
        assets.loadBinary(skel);
        assets.loadTextureAtlas(atlas);
        await waitForAssets(assets, () => cancelled);
        if (cancelled) {
          assets.dispose();
          return;
        }

        const textureAtlas = assets.require(atlas);
        // Texture NIKKE nhân sẵn alpha (atlas có "pma:true"), texture BD2 thì không: vẽ sai chế độ sẽ ra viền sáng.
        const premultiplied = textureAtlas.pages.every((p: { pma?: boolean }) => p.pma);
        const skeletonData = new spine.SkeletonBinary(
          new spine.AtlasAttachmentLoader(textureAtlas),
        ).readSkeletonData(assets.require(skel));
        const skeleton = new spine.Skeleton(skeletonData);
        const variant = pickSpineSkin(skeletonData, spineSkin);
        if (variant) skeleton.setSkin(variant);
        // Đổi skin khi đang chạy: gắn lại attachment của skin mới rồi trả các slot về tư thế gốc.
        // Skin "auto" (Fated Guest): mỗi cảnh `idleN` dùng skin riêng (`idleN_k`) và skin "default" có thể rỗng. Chọn skin cho ra nhiều
        // hình nhất ở animation nền hiện tại, chỉ bỏ "default" khi nó gần như rỗng.
        let autoSkin = false;
        let currentBase: string | undefined;
        const idleNameRef = { current: undefined as string | undefined }; // gán ngay khi biết idleName (bên dưới)
        const probeSkeleton = new spine.Skeleton(skeletonData);
        const probeStateData = new spine.AnimationStateData(skeletonData);
        const bestSkinFor = (anim: string | undefined) => {
          if (!anim || skeletonData.skins.length < 2) return null;
          const counts = skeletonData.skins.map((k) => {
            probeSkeleton.setSkin(k);
            probeSkeleton.setToSetupPose();
            const st = new spine.AnimationState(probeStateData);
            st.setAnimation(0, anim, true);
            st.update(0.5);
            st.apply(probeSkeleton);
            let n = 0;
            for (const slot of probeSkeleton.drawOrder) {
              const att = slot.getAttachment();
              if (att && slot.color.a >= 0.05 && (att instanceof spine.RegionAttachment || att instanceof spine.MeshAttachment)) n++;
            }
            return { skin: k, n };
          });
          const base = counts.find((c) => c.skin === skeletonData.defaultSkin)?.n ?? 0;
          const best = counts.reduce((a, b) => (b.n > a.n ? b : a));
          return base >= best.n * 0.5 ? skeletonData.defaultSkin : best.skin;
        };
        const applySkin = (skin: typeof skeletonData.defaultSkin) => {
          if (!skin) return;
          skeleton.setSkin(skin);
          skeleton.setSlotsToSetupPose();
        };
        skinRef.current = (name) => {
          autoSkin = name === "auto";
          if (autoSkin) applySkin(bestSkinFor(currentBase ?? idleNameRef.current));
          else applySkin(name ? skeletonData.findSkin(name) : (variant ?? skeletonData.defaultSkin));
        };
        const stateData = new spine.AnimationStateData(skeletonData);
        stateData.defaultMix = MIX_SECONDS;
        const state = new spine.AnimationState(stateData);

        // Một số mô hình Brown Dust 2 có animation biểu cảm `_faceN` còn đổi attachment của cả thân, nên bật nó lên là mất 20–70%
        // hình (đã gặp ở Luvencia, Scheherazade, Levia...). Thử từng cái trên một skeleton phụ, loại những cái làm mất hình.
        const brokenFaces = new Set<string>();
        {
          const faceAnims = skeletonData.animations.filter((a) => /^_face\d+(_talk)?$/.test(a.name));
          const allNames = skeletonData.animations.map((a) => a.name);
          const restName =
            (animation && skeletonData.findAnimation(animation)?.name) ?? cbRef.current.pickRest?.(allNames) ?? pickIdleAnimation(allNames);
          if (faceAnims.length > 0 && restName) {
            const probe = new spine.Skeleton(skeletonData);
            if (variant) probe.setSkin(variant);
            const probeData = new spine.AnimationStateData(skeletonData);
            const scratch: number[] = [];
            // Tổng diện tích hộp bao của mọi attachment đang hiện (đủ để so sánh trước/sau, không cần chính xác).
            const visibleArea = () => {
              let total = 0;
              for (const slot of probe.drawOrder) {
                const att = slot.getAttachment();
                if (!att || slot.color.a < 0.05) continue;
                let len = 0;
                if (att instanceof spine.RegionAttachment) {
                  len = 8;
                  scratch.length = len;
                  att.computeWorldVertices(slot, scratch, 0, 2);
                } else if (att instanceof spine.MeshAttachment) {
                  len = att.worldVerticesLength;
                  scratch.length = len;
                  att.computeWorldVertices(slot, 0, len, scratch, 0, 2);
                } else continue;
                let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
                for (let i = 0; i < len; i += 2) {
                  x0 = Math.min(x0, scratch[i]);
                  x1 = Math.max(x1, scratch[i]);
                  y0 = Math.min(y0, scratch[i + 1]);
                  y1 = Math.max(y1, scratch[i + 1]);
                }
                total += (x1 - x0) * (y1 - y0);
              }
              return total;
            };
            // Đo ở vài mốc thời gian (có animation chỉ đổi attachment thân sau nửa giây) và lấy mốc xấu nhất.
            const measure = (face: string | null) => {
              probe.setToSetupPose();
              const st = new spine.AnimationState(probeData);
              st.setAnimation(0, restName, true);
              if (face) st.setAnimation(1, face, true);
              let worst = Infinity;
              for (const dt of [0.2, 0.5, 0.6]) {
                st.update(dt);
                st.apply(probe);
                probe.updateWorldTransform();
                worst = Math.min(worst, visibleArea());
              }
              return worst;
            };
            const base = measure(null);
            if (base > 0) for (const a of faceAnims) if (measure(a.name) < base * 0.8) brokenFaces.add(a.name);
          }
        }
        const names = skeletonData.animations.map((a) => a.name).filter((n) => !brokenFaces.has(n));
        const idleName =
          (animation && skeletonData.findAnimation(animation)?.name) ??
          cbRef.current.pickRest?.(names) ??
          pickIdleAnimation(names);
        idleNameRef.current = idleName;
        if (skinNameRef.current) skinRef.current?.(skinNameRef.current);
        const reactions = reactionAnimations(names);
        let lastReaction: string | null = null;

        state.addListener({
          // Chỉ track 0 (hành động chính); track 1 là nhép miệng, không báo lên UI.
          start: (entry) => {
            if (entry.trackIndex === 0) cbRef.current.onPlaying?.(entry.animation?.name ?? "");
          },
        });

        /**
         * Idle (hoặc loop=true) thì lặp mãi; animation khác phát một lần rồi tự quay về idle.
         */
        const play = (name: string, loop = false, track = 0, base?: string) => {
          if (base && skeletonData.findAnimation(base)) {
            // Dựng lại từ tư thế gốc, không pha trộn: tranh Fated Guest nhiều lớp dễ dính trạng thái của animation trước.
            // `name` rỗng hoặc trùng `base` thì chỉ chạy nền.
            currentBase = base;
            if (autoSkin) applySkin(bestSkinFor(base));
            state.clearTracks();
            skeleton.setToSetupPose();
            const entries = [state.setAnimation(0, base, true)];
            if (name && name !== base && skeletonData.findAnimation(name)) entries.push(state.setAnimation(track || 1, name, loop));
            for (const e of entries) e.mixDuration = 0;
            return;
          }
          if (track > 0) {
            // Lớp chồng (biểu cảm...): giữ tới khi bị thay hoặc tắt; tên rỗng/không có = tắt.
            if (name && skeletonData.findAnimation(name)) state.setAnimation(track, name, loop);
            else state.setEmptyAnimation(track, MIX_SECONDS);
            return;
          }
          if (!skeletonData.findAnimation(name)) return;
          if (loop || isIdleAnimation(name) || !idleName) {
            state.setAnimation(0, name, true);
          } else {
            state.setAnimation(0, name, false);
            state.addAnimation(0, idleName, true, 0);
          }
        };
        playRef.current = play;

        // Kế hoạch theo thời gian (cutscene): các bước chạy ở khung hình đầu tiên có thời gian ≥ mốc `at`.
        let plan: { steps: PlanStep[]; i: number; t0: number } | null = null;
        planRef.current = (steps) => {
          plan = { steps: [...steps].sort((a, b) => a.at - b.at), i: 0, t0: performance.now() / 1000 };
        };

        /** Nhép miệng trên track 1, tách khỏi hành động chính ở track 0. */
        const hasTalk = !!skeletonData.findAnimation("talk_start");
        // Brown Dust 2 không có talk_start: mỗi biểu cảm `_faceN` có bản nhép miệng `_faceN_talk` (cùng track 1).
        const faceTalks = names.filter((n) => /^_face\d+_talk$/.test(n));
        let talking = false;
        let faceBefore: string | null = null; // biểu cảm người dùng đang chọn trước khi nói, để trả lại sau
        const talk = (on: boolean) => {
          if (on === talking) return;
          if (hasTalk) {
            talking = on;
            if (on) {
              state.setAnimation(1, "talk_start", true);
            } else {
              if (skeletonData.findAnimation("talk_end")) state.setAnimation(1, "talk_end", false);
              state.addEmptyAnimation(1, MIX_SECONDS, 0);
            }
            return;
          }
          if (faceTalks.length === 0) return;
          talking = on;
          if (on) {
            const cur = state.getCurrent(1)?.animation?.name;
            faceBefore = cur && /^_face\d+$/.test(cur) ? cur : null;
            const own = faceBefore && skeletonData.findAnimation(`${faceBefore}_talk`) ? `${faceBefore}_talk` : null;
            state.setAnimation(1, own ?? faceTalks[Math.floor(Math.random() * faceTalks.length)], true);
          } else if (faceBefore) {
            state.setAnimation(1, faceBefore, true);
          } else {
            state.setEmptyAnimation(1, MIX_SECONDS);
          }
        };
        talkRef.current = talk;
        if (idleName) state.setAnimation(0, idleName, true);

        // Khung hình đầu để đo bounds dùng cho việc căn giữa/vừa khung.
        skeleton.setToSetupPose();
        state.apply(skeleton);
        skeleton.updateWorldTransform();
        const offset = new spine.Vector2();
        const size = new spine.Vector2();
        skeleton.getBounds(offset, size, []);
        let centerX = offset.x + size.x / 2;
        let centerY = offset.y + size.y / 2;

        const slotByName = new Map(skeleton.slots.map((sl) => [sl.data.name, sl]));
        let hiddenNow = new Set<string>();
        const renderer = new spine.SceneRenderer(canvas, context);
        const cam = renderer.camera;
        if (fitContent && size.x > 0 && size.y > 0) {
          // Vẽ vùng (cx, cy, w, h) ở độ phân giải thấp rồi tìm cụm điểm ảnh sáng lớn nhất (bỏ qua mảng đen và các vệt mờ ở mép).
          const findContent = (cx: number, cy: number, w: number, h: number) => {
            const pw = 1024;
            const ph = Math.min(1024, Math.max(128, Math.round((pw * h) / w)));
            canvas.width = pw;
            canvas.height = ph;
            gl.viewport(0, 0, pw, ph);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            state.apply(skeleton);
            skeleton.updateWorldTransform();
            cam.zoom = 1;
            cam.position.x = cx;
            cam.position.y = cy;
            cam.setViewport(w, h);
            cam.update();
            renderer.begin();
            renderer.drawSkeleton(skeleton, premultiplied);
            renderer.end();
            const buf = new Uint8Array(pw * ph * 4);
            gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            const C = 8;
            const gw = Math.ceil(pw / C);
            const gh = Math.ceil(ph / C);
            const count = new Uint16Array(gw * gh);
            for (let y = 0; y < ph; y++) {
              for (let x = 0; x < pw; x++) {
                const i = (y * pw + x) * 4;
                if (buf[i + 3] > 20 && buf[i] + buf[i + 1] + buf[i + 2] > 90) count[Math.floor(y / C) * gw + Math.floor(x / C)]++;
              }
            }
            // Thành phần liên thông (theo ô 8×8) có nhiều ô nhất.
            const on = (c: number) => count[c] >= C * C * 0.15;
            const seen = new Uint8Array(gw * gh);
            let best: { n: number; x0: number; x1: number; y0: number; y1: number } | null = null;
            for (let start = 0; start < gw * gh; start++) {
              if (seen[start] || !on(start)) continue;
              const stack = [start];
              seen[start] = 1;
              const comp = { n: 0, x0: gw, x1: -1, y0: gh, y1: -1 };
              while (stack.length) {
                const c = stack.pop()!;
                const cx0 = c % gw;
                const cy0 = Math.floor(c / gw);
                comp.n++;
                comp.x0 = Math.min(comp.x0, cx0);
                comp.x1 = Math.max(comp.x1, cx0);
                comp.y0 = Math.min(comp.y0, cy0);
                comp.y1 = Math.max(comp.y1, cy0);
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                  const nx = cx0 + dx;
                  const ny = cy0 + dy;
                  if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
                  const nc = ny * gw + nx;
                  if (!seen[nc] && on(nc)) {
                    seen[nc] = 1;
                    stack.push(nc);
                  }
                }
              }
              if (!best || comp.n > best.n) best = comp;
            }
            if (!best || best.n < 4) return null;
            // readPixels đếm từ đáy lên, cùng chiều với trục y của thế giới Spine.
            const left = cx - w / 2 + (best.x0 * C * w) / pw;
            const right = cx - w / 2 + (Math.min(pw, (best.x1 + 1) * C) * w) / pw;
            const bottom = cy - h / 2 + (best.y0 * C * h) / ph;
            const top = cy - h / 2 + (Math.min(ph, (best.y1 + 1) * C) * h) / ph;
            return { cx: (left + right) / 2, cy: (bottom + top) / 2, w: right - left, h: top - bottom };
          };
          const coarse = findContent(centerX, centerY, size.x, size.y);
          if (coarse) {
            // Lần hai: vẽ lại riêng vùng đó (nở ra 8%) để hộp bao khít hơn nhiều.
            const pad = 1.16;
            const fine = findContent(coarse.cx, coarse.cy, coarse.w * pad, coarse.h * pad) ?? coarse;
            centerX = fine.cx;
            centerY = fine.cy;
            size.x = fine.w;
            size.y = fine.h;
          }
        }
        let last = performance.now() / 1000;
        const pixels = new Uint8Array((HIT_RADIUS_PX * 2 + 1) ** 2 * 4);
        // Vùng đệm hiện hành: tiến dần về giá trị đích để nhân vật trượt mượt khi giao diện đóng/mở.
        const cur = { ...insetsRef.current };

        /** Đọc vùng nhỏ quanh điểm nhấp từ framebuffer vừa vẽ; có pixel đặc là trúng nhân vật. */
        const hitTest = (clientX: number, clientY: number, dpr: number, ph: number) => {
          const rect = canvas.getBoundingClientRect();
          const r = HIT_RADIUS_PX;
          const px = Math.round((clientX - rect.left) * dpr) - r;
          const py = ph - 1 - Math.round((clientY - rect.top) * dpr) - r;
          if (px < 0 || py < 0 || px + 2 * r + 1 > canvas.width || py + 2 * r + 1 > ph) return false;
          gl.readPixels(px, py, 2 * r + 1, 2 * r + 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > HIT_ALPHA) return true;
          return false;
        };

        const frame = () => {
          const now = performance.now() / 1000;
          const delta = Math.min(now - last, 0.1);
          last = now;

          const dpr = window.devicePixelRatio || 1;
          const cw = canvas.clientWidth;
          const ch = canvas.clientHeight;
          const pw = Math.max(1, Math.round(cw * dpr));
          const ph = Math.max(1, Math.round(ch * dpr));
          if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
          }
          gl.viewport(0, 0, pw, ph);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          state.timeScale = speedRef.current;
          state.update(delta);
          state.apply(skeleton);
          // Ẩn lớp: đặt alpha slot về 0 sau khi áp animation; lớp được bật lại thì trả về màu gốc của slot.
          const hide = hiddenRef.current;
          if (hide.length || hiddenNow.size) {
            for (const n of hiddenNow) {
              const sl = slotByName.get(n);
              if (sl && !hide.includes(n)) sl.color.a = sl.data.color.a;
            }
            hiddenNow = new Set(hide);
            for (const n of hide) {
              const sl = slotByName.get(n);
              if (sl) sl.color.a = 0;
            }
          }
          skeleton.updateWorldTransform();

          // Ánh xạ transform của stage (px màn hình, gốc ở tâm khung) sang camera Spine.
          const { x, y, scale } = transformRef.current;
          const target = insetsRef.current;
          const ease = 1 - Math.exp(-delta * 12);
          cur.top += (target.top - cur.top) * ease;
          cur.right += (target.right - cur.right) * ease;
          cur.bottom += (target.bottom - cur.bottom) * ease;
          cur.left += (target.left - cur.left) * ease;
          const availW = Math.max(1, cw - cur.left - cur.right);
          const availH = Math.max(1, ch - cur.top - cur.bottom);
          const k = Math.min(availW / size.x, availH / size.y) * scale; // px CSS / đơn vị thế giới (vừa khít vùng còn trống)
          const offX = (cur.left - cur.right) / 2; // tâm vùng còn trống lệch khỏi tâm khung
          const offY = (cur.top - cur.bottom) / 2;
          cam.zoom = 1;
          cam.position.x = centerX - (x + offX) / k;
          cam.position.y = centerY + (y + offY) / k;
          cam.setViewport(cw / k, ch / k);
          cam.update();

          if (plan) {
            const elapsed = performance.now() / 1000 - plan.t0;
            while (plan.i < plan.steps.length && plan.steps[plan.i].at <= elapsed) {
              const st = plan.steps[plan.i++];
              // Phát thẳng (không tự nối về idle như `play`): cutscene tự lo thứ tự và vòng lặp cuối.
              if (st.name && skeletonData.findAnimation(st.name)) state.setAnimation(st.track, st.name, st.loop ?? false);
              else if (st.track > 0) state.setEmptyAnimation(st.track, MIX_SECONDS);
            }
            if (plan.i >= plan.steps.length) plan = null;
          }

          renderer.begin();
          renderer.drawSkeleton(skeleton, premultiplied);
          renderer.end();

          const tap = tapRequest.current;
          if (tap) {
            tapRequest.current = null;
            const custom = cbRef.current.tapPlan;
            // Chỉ phản ứng khi nhân vật đang ở tư thế chờ và chưa có gì xếp hàng phía sau: nhấp chồng lên một cử động đang
            // chạy sẽ ngắt nó giữa chừng và pha trộn hai tư thế (thân/tóc/đồ vật lệch nhau, đôi khi biến mất).
            const cur = state.getCurrent(0);
            const resting = !!cur && !cur.next && !!cur.animation && (cur.animation.name === idleName || isIdleAnimation(cur.animation.name));
            if (resting && (custom || reactions.length > 0) && hitTest(tap.clientX, tap.clientY, dpr, ph)) {
              if (custom) {
                const plan = custom(names, lastReaction);
                if (plan?.body) {
                  lastReaction = plan.body;
                  play(plan.body);
                }
                if (plan?.overlay && skeletonData.findAnimation(plan.overlay.name)) {
                  state.setAnimation(1, plan.overlay.name, true);
                  const track1 = state.getCurrent(1);
                  window.setTimeout(() => {
                    // Chỉ tắt nếu lớp chồng vẫn là biểu cảm vừa đặt (người dùng chưa chọn cái khác) và cảnh chưa bị huỷ.
                    if (!cancelled && state.getCurrent(1) === track1) state.setEmptyAnimation(1, MIX_SECONDS);
                  }, plan.overlay.ms);
                }
              } else {
                const pool = reactions.length > 1 ? reactions.filter((n) => n !== lastReaction) : reactions;
                lastReaction = pool[Math.floor(Math.random() * pool.length)];
                play(lastReaction);
              }
              cbRef.current.onTouch?.();
            }
          }
          raf = requestAnimationFrame(frame);
        };

        setStatus("ready");
        talk(speakingRef.current); // voice có thể đã bắt đầu nói trong lúc Spine còn đang tải
        cbRef.current.onSkins?.(skeletonData.skins.map((k) => k.name));
        cbRef.current.onSlots?.(skeleton.slots.map((sl) => sl.data.name));
        cbRef.current.onAnimations?.(names, Object.fromEntries(skeletonData.animations.map((a) => [a.name, a.duration])));
        // setAnimation đã xả sự kiện "start" của idle từ trước khi danh sách được báo, nên báo lại ở đây.
        if (idleName) cbRef.current.onPlaying?.(idleName);
        frame();
        requestAnimationFrame(() => {
          canvas.style.opacity = "1";
          cbRef.current.onReady?.();
        });

        dispose = () => {
          cancelAnimationFrame(raf);
          renderer.dispose();
          assets.dispose();
        };
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      playRef.current = null;
      skinRef.current = null;
      planRef.current = null;
      talkRef.current = null;
      cancelAnimationFrame(raf);
      dispose();
      loseContext();
      canvas.remove();
      setStatus("loading"); // nếu effect chạy lại (hiện lại trang), hiển thị trạng thái tải trong lúc nạp lại
    };
  }, [skel, atlas, version, animation, spineSkin, fitContent, label, transformRef, insetsRef]);

  return (
    <>
      <div ref={hostRef} className="absolute inset-0" />
      {status !== "ready" && !(status === "loading" && quietLoading) && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center font-mono text-xs uppercase tracking-[0.2em] text-white/60">
          {status === "loading" ? (
            <span className="animate-blink">Loading unit data…</span>
          ) : (
            <span className="text-red-400">Không tải được Spine: {errorMsg}</span>
          )}
        </div>
      )}
    </>
  );
}
