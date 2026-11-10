"use client";

import { useEffect, useRef, useState } from "react";
import { useViewerInsets, useViewerTap, useViewerTransform } from "../ViewerStage";

declare global {
  interface Window {
    PIXI?: unknown;
    Live2DCubismCore?: unknown;
  }
}

export type MotionCommand = { name: string; nonce: number };

const CORE_URL = "/vendor/live2dcubismcore.min.js";
let corePromise: Promise<void> | null = null;

/** Nạp lõi Live2D Cubism (tải về local bằng scripts/azurlane/fetch-cubism-core.mjs); chỉ nạp một lần cho cả phiên. */
function loadCore(): Promise<void> {
  if (window.Live2DCubismCore) return Promise.resolve();
  return (corePromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CORE_URL;
    s.onload = () => resolve();
    s.onerror = () => {
      corePromise = null;
      reject(new Error("Thiếu public/vendor/live2dcubismcore.min.js: chạy node scripts/azurlane/fetch-cubism-core.mjs"));
    };
    document.head.appendChild(s);
  }));
}

const TOUCH: [string, string][] = [
  ["TouchSpecial", "touch_special"],
  ["TouchHead", "touch_head"],
  ["TouchBody", "touch_body"],
];

/**
 * Vẽ một mô hình Live2D (Cubism) bằng pixi-live2d-display. Dùng bên trong <ViewerStage cssTransform={false}> như SpineRenderer: zoom/kéo đọc từ
 * transform của khung và áp thẳng lên mô hình nên không bị mờ khi phóng to.
 *  - Mô hình tự phát motion "idle" lặp lại, chớp mắt và vật lý theo khai báo trong model3.json.
 *  - Mô hình nhìn theo con trỏ chuột. Nhấp vào vùng TouchHead / TouchBody / TouchSpecial thì phát motion tương ứng; nhấp vào chỗ khác
 *    trên người thì phát ngẫu nhiên một câu ở màn hình chính (main_1..3).
 *  - Thư viện Pixi và Cubism chỉ được nạp khi component này chạy (trang nhân vật), không nằm trong bundle các trang khác.
 */
export function Live2DRenderer({
  modelUrl,
  label,
  command,
  onMotions,
  onPlaying,
  onReady,
}: {
  modelUrl: string;
  label: string;
  /** Yêu cầu phát một motion từ bên ngoài (nonce đổi thì phát lại). */
  command?: MotionCommand | null;
  /** Báo danh sách motion của mô hình khi nạp xong. */
  onMotions?: (names: string[]) => void;
  /** Báo motion bắt đầu phát (kể cả idle tự lặp). */
  onPlaying?: (name: string) => void;
  onReady?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const transformRef = useViewerTransform();
  const insetsRef = useViewerInsets();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const playRef = useRef<((name: string) => void) | null>(null);
  const tapRef = useRef<((x: number, y: number) => void) | null>(null);
  const cbRef = useRef({ onMotions, onPlaying, onReady });
  useEffect(() => {
    cbRef.current = { onMotions, onPlaying, onReady };
  });

  useViewerTap((pt) => tapRef.current?.(pt.clientX, pt.clientY));

  useEffect(() => {
    if (command) playRef.current?.(command.name);
  }, [command]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    const host = hostRef.current;
    if (!host) return;

    (async () => {
      try {
        await loadCore();
        const PIXI = await import("pixi.js");
        window.PIXI = PIXI; // pixi-live2d-display tìm Pixi ở biến toàn cục
        const { Live2DModel, MotionPriority } = await import("pixi-live2d-display/cubism4");
        if (cancelled) return;

        const canvas = document.createElement("canvas");
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", label);
        canvas.className = "pointer-events-none absolute inset-0 h-full w-full";
        canvas.style.opacity = "0";
        canvas.style.transition = "opacity 220ms ease-out";
        host.appendChild(canvas);

        const app = new PIXI.Application({
          view: canvas,
          resizeTo: host,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        const model = await Live2DModel.from(modelUrl, { autoInteract: false });
        if (cancelled) {
          model.destroy();
          app.destroy(false, { children: true, texture: true, baseTexture: true });
          canvas.remove();
          return;
        }
        app.stage.addChild(model);

        const internal = model.internalModel;
        internal.motionManager.groups.idle = "idle"; // nhóm motion tự lặp khi rảnh (mặc định của thư viện là "Idle")
        const names = Object.keys((internal.settings as { motions?: Record<string, unknown> }).motions ?? {});
        cbRef.current.onMotions?.(names);
        internal.motionManager.on("motionStart", (group: string) => cbRef.current.onPlaying?.(group));

        // Khung hình: vừa khít vùng còn trống rồi nhân với zoom, dịch theo kéo thả (đọc mỗi frame, không re-render).
        const ow = internal.originalWidth;
        const oh = internal.originalHeight;
        model.anchor.set(0.5, 0.5);
        app.ticker.add(() => {
          const w = app.screen.width;
          const h = app.screen.height;
          const t = transformRef.current;
          const ins = insetsRef.current;
          const availW = Math.max(1, w - ins.left - ins.right);
          const availH = Math.max(1, h - ins.top - ins.bottom);
          model.scale.set(Math.min(availW / ow, availH / oh) * 0.94 * t.scale);
          model.position.set(ins.left + availW / 2 + t.x, ins.top + availH / 2 + t.y);
        });

        const play = (name: string) => {
          if (names.includes(name)) void model.motion(name, undefined, MotionPriority.FORCE);
        };
        playRef.current = play;
        tapRef.current = (cx, cy) => {
          const r = canvas.getBoundingClientRect();
          const x = cx - r.left;
          const y = cy - r.top;
          const hit = model.hitTest(x, y);
          const area = TOUCH.find(([id]) => hit.includes(id));
          if (area) return play(area[1]);
          if (model.getBounds().contains(x, y)) {
            const mains = names.filter((n) => n.startsWith("main_"));
            if (mains.length) play(mains[Math.floor(Math.random() * mains.length)]);
          }
        };
        const onMove = (e: PointerEvent) => {
          const r = canvas.getBoundingClientRect();
          model.focus(e.clientX - r.left, e.clientY - r.top);
        };
        window.addEventListener("pointermove", onMove);

        app.ticker.addOnce(() => {
          canvas.style.opacity = "1";
          setStatus("ready");
          cbRef.current.onReady?.();
        });

        cleanup = () => {
          window.removeEventListener("pointermove", onMove);
          playRef.current = null;
          tapRef.current = null;
          model.destroy();
          const gl = "gl" in app.renderer ? (app.renderer as { gl: WebGLRenderingContext }).gl : null;
          app.destroy(false, { children: true, texture: true, baseTexture: true });
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
          canvas.remove();
        };
        if (cancelled) cleanup();
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
      setStatus("loading");
    };
  }, [modelUrl, label, transformRef, insetsRef]);

  return (
    <>
      <div ref={hostRef} className="absolute inset-0" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center font-mono text-xs uppercase tracking-[0.2em] text-white/60">
          {status === "loading" ? <span className="animate-blink">Đang tải mô hình…</span> : <span className="text-red-400">Không tải được Live2D: {errorMsg}</span>}
        </div>
      )}
    </>
  );
}
