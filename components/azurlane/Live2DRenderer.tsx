"use client";

import { useEffect, useRef, useState } from "react";
import { captureScale, type CaptureFn } from "@/lib/capture";
import { useViewerCapture, useViewerInsets, useViewerTap, useViewerTransform } from "../ViewerStage";

declare global {
  interface Window {
    PIXI?: unknown;
    Live2DCubismCore?: unknown;
  }
}

export type MotionCommand = { name: string; nonce: number };
/** Câu thoại cần phát (nonce đổi thì phát lại). */
export type Speech = { src: string; text?: string; nonce: number };

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
 *  - `speech`: phát câu thoại, miệng nhép theo âm lượng (thư viện 0.4.0 chưa có sẵn nhép miệng nên đo âm lượng bằng Web Audio và ghi vào ParamMouthOpenY).
 *  - Thư viện Pixi và Cubism chỉ được nạp khi component này chạy (trang nhân vật), không nằm trong bundle các trang khác.
 */
export function Live2DRenderer({
  modelUrl,
  label,
  command,
  onMotions,
  onPlaying,
  onReady,
  speech,
  onSpeechEnd,
  onSpeechBlocked,
  quietLoading = false,
  compareUrl,
  compareLayout = "row",
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
  /** Câu thoại đang cần phát; null thì dừng. */
  speech?: Speech | null;
  /** Báo khi câu thoại phát xong (hoặc không phát được). */
  onSpeechEnd?: () => void;
  /** Báo khi trình duyệt chặn tự phát tiếng (chưa có thao tác nào của người dùng); câu thoại vẫn đang chờ. */
  onSpeechBlocked?: () => void;
  /** Không hiện chữ "Đang tải" (dùng cho xem trước trên thẻ). */
  quietLoading?: boolean;
  /**
   * Mô hình thứ hai để so sánh: vẽ chung một canvas với mô hình chính (hai canvas WebGL riêng thì shader dùng chung của Cubism hỏng ở canvas tạo trước),
   * chia khung làm đôi theo `compareLayout`. Hoạt cảnh (`command`) chạy cho cả hai; phụ đề, voice và báo trạng thái chỉ theo mô hình chính.
   */
  compareUrl?: string;
  compareLayout?: "row" | "column";
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const transformRef = useViewerTransform();
  const insetsRef = useViewerInsets();
  const captureImpl = useRef<CaptureFn | null>(null);
  useViewerCapture(captureImpl);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const playRef = useRef<((name: string) => void) | null>(null);
  const tapRef = useRef<((x: number, y: number) => void) | null>(null);
  const layoutRef = useRef(compareLayout);
  useEffect(() => {
    layoutRef.current = compareLayout;
  });
  const speakRef = useRef<((src: string) => void) | null>(null);
  const stopSpeakRef = useRef<(() => void) | null>(null);
  const cbRef = useRef({ onMotions, onPlaying, onReady, onSpeechEnd, onSpeechBlocked });
  useEffect(() => {
    cbRef.current = { onMotions, onPlaying, onReady, onSpeechEnd, onSpeechBlocked };
  });
  // Câu thoại mới nhất; nếu đến trước khi mô hình nạp xong thì phát ngay khi sẵn sàng.
  const speechRef = useRef<Speech | null>(null);

  useViewerTap((pt) => tapRef.current?.(pt.clientX, pt.clientY));

  useEffect(() => {
    if (command) playRef.current?.(command.name);
  }, [command]);

  useEffect(() => {
    speechRef.current = speech ?? null;
    if (speech) speakRef.current?.(speech.src);
    else stopSpeakRef.current?.();
  }, [speech]);

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
        // pixi chỉ theo dõi kích thước cửa sổ; khung đổi cỡ (chế độ so sánh, toàn màn hình) thì phải tự báo.
        const ro = new ResizeObserver(() => app.resize());
        ro.observe(host);
        const urls = compareUrl ? [modelUrl, compareUrl] : [modelUrl];
        const loaded = await Promise.allSettled(urls.map((u) => Live2DModel.from(u, { autoInteract: false })));
        const models = loaded.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
        const failed = loaded.find((r) => r.status === "rejected");
        if (cancelled || failed) {
          ro.disconnect();
          for (const m of models) m.destroy();
          app.destroy(false, { children: true, texture: true, baseTexture: true });
          canvas.remove();
          if (failed && !cancelled) throw (failed as PromiseRejectedResult).reason;
          return;
        }
        const model = models[0];
        for (const m of models) app.stage.addChild(m);

        const internal = model.internalModel;
        const motionNames = models.map((m) => {
          m.internalModel.motionManager.groups.idle = "idle"; // nhóm motion tự lặp khi rảnh (mặc định của thư viện là "Idle")
          return Object.keys((m.internalModel.settings as { motions?: Record<string, unknown> }).motions ?? {});
        });
        const names = motionNames[0];
        cbRef.current.onMotions?.(names);
        internal.motionManager.on("motionStart", (group: string) => cbRef.current.onPlaying?.(group));

        // Khung hình: vừa khít phần còn trống rồi nhân với zoom, dịch theo kéo thả (đọc mỗi frame, không re-render).
        // Hai mô hình thì mỗi cái một nửa (cạnh nhau hoặc trên/dưới); zoom và kéo áp chung cho cả hai.
        for (const m of models) m.anchor.set(0.5, 0.5);
        app.ticker.add(() => {
          const w = app.screen.width;
          const h = app.screen.height;
          const t = transformRef.current;
          const ins = insetsRef.current;
          const availW = Math.max(1, w - ins.left - ins.right);
          const availH = Math.max(1, h - ins.top - ins.bottom);
          const column = models.length > 1 && layoutRef.current === "column";
          const slotW = models.length > 1 && !column ? availW / models.length : availW;
          const slotH = column ? availH / models.length : availH;
          models.forEach((m, i) => {
            const { originalWidth: ow, originalHeight: oh } = m.internalModel;
            m.scale.set(Math.min(slotW / ow, slotH / oh) * 0.94 * t.scale);
            m.position.set(ins.left + (column ? availW / 2 : slotW * (i + 0.5)) + t.x, ins.top + (column ? slotH * (i + 0.5) : availH / 2) + t.y);
          });
        });

        // Chụp ảnh: vẽ lại một khung ở kích thước đích (độ phân giải 1:1) rồi trả lại như cũ. Vùng trống (không bị giao diện che) vừa chiều cao ảnh,
        // zoom/kéo hiện tại giữ nguyên. Tất cả diễn ra đồng bộ trong một lượt nên khung chụp không lọt ra màn hình.
        captureImpl.current = async ({ width, height, fit: framing }) => {
          const renderer = app.renderer as typeof app.renderer & { resolution: number; gl?: WebGLRenderingContext };
          const cw = app.screen.width;
          const ch = app.screen.height;
          const ins = insetsRef.current;
          const availW = Math.max(1, cw - ins.left - ins.right);
          const availH = Math.max(1, ch - ins.top - ins.bottom);
          const maxDim = renderer.gl?.getParameter(renderer.gl.MAX_VIEWPORT_DIMS) as Int32Array | undefined;
          const fit = maxDim ? Math.min(1, maxDim[0] / width, maxDim[1] / height) : 1;
          const W = Math.max(1, Math.round(width * fit));
          const H = Math.max(1, Math.round(height * fit));
          const kT = captureScale(W, H, availW, availH, framing); // mô hình đã có lề 6% sẵn
          const cx0 = ins.left + availW / 2;
          const cy0 = ins.top + availH / 2;
          const saved = models.map((m) => ({ s: m.scale.x, x: m.x, y: m.y }));
          const prevResolution = renderer.resolution;
          try {
            models.forEach((m, i) => {
              m.scale.set(saved[i].s * kT);
              m.position.set(W / 2 + (saved[i].x - cx0) * kT, H / 2 + (saved[i].y - cy0) * kT);
            });
            renderer.resolution = 1;
            renderer.resize(W, H);
            renderer.render(app.stage);
            const out = document.createElement("canvas");
            out.width = W;
            out.height = H;
            out.getContext("2d")!.drawImage(canvas, 0, 0);
            return out;
          } catch {
            return null;
          } finally {
            renderer.resolution = prevResolution;
            app.resize();
            models.forEach((m, i) => {
              m.scale.set(saved[i].s);
              m.position.set(saved[i].x, saved[i].y);
            });
            renderer.render(app.stage);
          }
        };

        const motion = (m: (typeof models)[number], list: string[], name: string) => {
          if (list.includes(name)) void m.motion(name, undefined, MotionPriority.FORCE);
        };
        playRef.current = (name) => models.forEach((m, i) => motion(m, motionNames[i], name));
        tapRef.current = (cx, cy) => {
          const r = canvas.getBoundingClientRect();
          const x = cx - r.left;
          const y = cy - r.top;
          for (let i = models.length - 1; i >= 0; i--) {
            const m = models[i];
            const hit = m.hitTest(x, y);
            const area = TOUCH.find(([id]) => hit.includes(id));
            if (area) return motion(m, motionNames[i], area[1]);
            if (m.getBounds().contains(x, y)) {
              const mains = motionNames[i].filter((n) => n.startsWith("main_"));
              if (mains.length) motion(m, motionNames[i], mains[Math.floor(Math.random() * mains.length)]);
              return;
            }
          }
        };

        // Câu thoại: phát bằng <audio> qua Web Audio để đo âm lượng, rồi mỗi frame (sau khi animation cập nhật) ghi độ mở miệng.
        let audio: HTMLAudioElement | null = null;
        let analyser: AnalyserNode | null = null;
        let audioCtx: AudioContext | null = null;
        let mouth = 0;
        const samples = new Uint8Array(256);
        const stopSpeech = () => {
          if (audio) {
            audio.onended = null;
            audio.onerror = null;
            audio.pause();
            audio = null;
          }
          analyser = null;
          mouth = 0;
        };
        internal.on("afterMotionUpdate", () => {
          if (!analyser) return;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const v of samples) sum += ((v - 128) / 128) ** 2;
          mouth += (Math.min(1, Math.sqrt(sum / samples.length) * 5) - mouth) * 0.5;
          (internal.coreModel as unknown as { setParameterValueById(id: string, value: number): void }).setParameterValueById("ParamMouthOpenY", mouth);
        });
        speakRef.current = (src) => {
          stopSpeech();
          const a = new Audio(src);
          const end = () => {
            if (audio !== a) return;
            stopSpeech();
            cbRef.current.onSpeechEnd?.();
          };
          try {
            audioCtx ??= new AudioContext();
            const node = audioCtx.createAnalyser();
            node.fftSize = 256;
            audioCtx.createMediaElementSource(a).connect(node);
            node.connect(audioCtx.destination);
            analyser = node;
            audioCtx.resume().catch(() => {});
          } catch {
            // Không có Web Audio: vẫn phát tiếng, chỉ không nhép miệng.
          }
          audio = a;
          a.onended = end;
          a.onerror = end;
          a.play().catch((err: unknown) => {
            // Trình duyệt chặn tự phát khi chưa có thao tác nào: giữ câu thoại để phát lại ở cử chỉ đầu tiên.
            if (err instanceof DOMException && err.name === "NotAllowedError" && audio === a) {
              stopSpeech();
              cbRef.current.onSpeechBlocked?.();
            } else end();
          });
        };
        stopSpeakRef.current = stopSpeech;
        if (speechRef.current) speakRef.current(speechRef.current.src);

        const onMove = (e: PointerEvent) => {
          const r = canvas.getBoundingClientRect();
          for (const m of models) m.focus(e.clientX - r.left, e.clientY - r.top);
        };
        window.addEventListener("pointermove", onMove);

        app.ticker.addOnce(() => {
          canvas.style.opacity = "1";
          setStatus("ready");
          cbRef.current.onReady?.();
        });

        cleanup = () => {
          captureImpl.current = null;
          window.removeEventListener("pointermove", onMove);
          ro.disconnect();
          playRef.current = null;
          tapRef.current = null;
          stopSpeech();
          speakRef.current = null;
          stopSpeakRef.current = null;
          audioCtx?.close().catch(() => {});
          for (const m of models) m.destroy();
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
  }, [modelUrl, compareUrl, label, transformRef, insetsRef]);

  return (
    <>
      <div ref={hostRef} className="absolute inset-0" />
      {status !== "ready" && !quietLoading && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center font-mono text-xs uppercase tracking-[0.2em] text-white/60">
          {status === "loading" ? <span className="animate-blink">Đang tải mô hình…</span> : <span className="text-red-400">Không tải được Live2D: {errorMsg}</span>}
        </div>
      )}
    </>
  );
}
