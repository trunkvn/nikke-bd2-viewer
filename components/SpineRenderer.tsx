"use client";

import { useEffect, useRef, useState } from "react";
import type { Render } from "@/data/types";
import { isIdleAnimation, pickIdleAnimation, reactionAnimations } from "@/lib/animations";
import { useViewerInsets, useViewerTap, useViewerTransform } from "./ViewerStage";

type SpineRender = Extract<Render, { kind: "spine" }>;
type Runtime = typeof import("spine-webgl-41");

/** Yêu cầu phát một animation; nonce đổi để phát lại cùng animation được. */
export type PlayCommand = {
  name: string;
  nonce: number;
  loop?: boolean;
};

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
  interactive = true,
  onReady,
  quietLoading = false,
}: {
  render: SpineRender;
  label: string;
  /** Yêu cầu phát animation từ bên ngoài (thanh chọn animation). */
  command?: PlayCommand | null;
  /** Báo danh sách animation của skeleton ngay khi nạp xong. */
  onAnimations?: (names: string[]) => void;
  /** Báo animation đang phát (kể cả khi tự quay về idle). */
  onPlaying?: (name: string) => void;
  /** Báo khi người dùng nhấp trúng nhân vật (cùng lúc nhân vật phản ứng). */
  onTouch?: () => void;
  /** Đang phát giọng nói: nhép miệng bằng animation talk_* trên track riêng. */
  speaking?: boolean;
  /** false: lớp đang mờ đi khi chuyển skin/tư thế, không nhận nhấp chuột. */
  interactive?: boolean;
  /** Báo khi khung hình đầu tiên đã vẽ xong (để lớp cũ biết lúc mờ đi). */
  onReady?: () => void;
  /** Không hiện chữ "đang tải" (khi lớp cũ vẫn đang hiển thị phía dưới, chữ sẽ nổi đè lên nhân vật cũ). */
  quietLoading?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const transformRef = useViewerTransform();
  const insetsRef = useViewerInsets();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const playRef = useRef<((name: string, loop?: boolean) => void) | null>(null);
  const tapRequest = useRef<{ clientX: number; clientY: number } | null>(null);
  const talkRef = useRef<((on: boolean) => void) | null>(null);
  const speakingRef = useRef(speaking);
  const cbRef = useRef({ onAnimations, onPlaying, onTouch, onReady });
  useEffect(() => {
    cbRef.current = { onAnimations, onPlaying, onTouch, onReady };
  });
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
    if (command) playRef.current?.(command.name, command.loop);
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

        const skeletonData = new spine.SkeletonBinary(
          new spine.AtlasAttachmentLoader(assets.require(atlas)),
        ).readSkeletonData(assets.require(skel));
        const skeleton = new spine.Skeleton(skeletonData);
        const variant = pickSpineSkin(skeletonData, spineSkin);
        if (variant) skeleton.setSkin(variant);
        const stateData = new spine.AnimationStateData(skeletonData);
        stateData.defaultMix = MIX_SECONDS;
        const state = new spine.AnimationState(stateData);

        const names = skeletonData.animations.map((a) => a.name);
        const idleName =
          (animation && skeletonData.findAnimation(animation)?.name) ?? pickIdleAnimation(names);
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
        const play = (name: string, loop = false) => {
          if (!skeletonData.findAnimation(name)) return;
          if (loop || isIdleAnimation(name) || !idleName) {
            state.setAnimation(0, name, true);
          } else {
            state.setAnimation(0, name, false);
            state.addAnimation(0, idleName, true, 0);
          }
        };
        playRef.current = play;

        /** Nhép miệng trên track 1, tách khỏi hành động chính ở track 0. */
        const hasTalk = !!skeletonData.findAnimation("talk_start");
        let talking = false;
        const talk = (on: boolean) => {
          if (!hasTalk || on === talking) return;
          talking = on;
          if (on) {
            state.setAnimation(1, "talk_start", true);
          } else {
            if (skeletonData.findAnimation("talk_end")) state.setAnimation(1, "talk_end", false);
            state.addEmptyAnimation(1, MIX_SECONDS, 0);
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
        const centerX = offset.x + size.x / 2;
        const centerY = offset.y + size.y / 2;

        const renderer = new spine.SceneRenderer(canvas, context);
        const cam = renderer.camera;
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

          state.update(delta);
          state.apply(skeleton);
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

          renderer.begin();
          renderer.drawSkeleton(skeleton, true);
          renderer.end();

          const tap = tapRequest.current;
          if (tap) {
            tapRequest.current = null;
            if (reactions.length > 0 && hitTest(tap.clientX, tap.clientY, dpr, ph)) {
              const pool = reactions.length > 1 ? reactions.filter((n) => n !== lastReaction) : reactions;
              lastReaction = pool[Math.floor(Math.random() * pool.length)];
              play(lastReaction);
              cbRef.current.onTouch?.();
            }
          }
          raf = requestAnimationFrame(frame);
        };

        setStatus("ready");
        talk(speakingRef.current); // voice có thể đã bắt đầu nói trong lúc Spine còn đang tải
        cbRef.current.onAnimations?.(names);
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
      talkRef.current = null;
      cancelAnimationFrame(raf);
      dispose();
      loseContext();
      canvas.remove();
      setStatus("loading"); // nếu effect chạy lại (hiện lại trang), hiển thị trạng thái tải trong lúc nạp lại
    };
  }, [skel, atlas, version, animation, spineSkin, label, transformRef, insetsRef]);

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
