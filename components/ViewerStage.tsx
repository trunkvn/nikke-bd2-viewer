"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export type Transform = { x: number; y: number; scale: number };

/** Vùng đệm (px) bị các lớp giao diện phủ lên: nhân vật được căn giữa trong phần còn trống. */
export type Insets = { top: number; right: number; bottom: number; left: number };
const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const INITIAL: Transform = { x: 0, y: 0, scale: 1 };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export type TapPoint = { clientX: number; clientY: number };
type TapListener = (pt: TapPoint) => void;

type StageApi = {
  transformRef: RefObject<Transform>;
  insetsRef: RefObject<Insets>;
  tapListeners: RefObject<Set<TapListener>>;
};

const StageContext = createContext<StageApi | null>(null);

function useStageApi(): StageApi {
  const api = useContext(StageContext);
  if (!api) throw new Error("Hook này phải được dùng bên trong <ViewerStage>");
  return api;
}

/**
 * Renderer tự vẽ theo transform (ví dụ Spine dùng camera để zoom sắc nét) đọc giá trị
 * mới nhất mỗi frame qua ref này, không gây re-render.
 */
export function useViewerTransform(): RefObject<Transform> {
  return useStageApi().transformRef;
}

/** Vùng đệm hiện tại (giá trị đích); renderer tự làm mượt khi nó thay đổi. */
export function useViewerInsets(): RefObject<Insets> {
  return useStageApi().insetsRef;
}

/** Nhận một cú "tap" (nhấp không kéo) trên khung, toạ độ theo clientX/clientY. */
export function useViewerTap(handler: TapListener) {
  const { tapListeners } = useStageApi();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    const listeners = tapListeners.current;
    const listener: TapListener = (pt) => handlerRef.current(pt);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [tapListeners]);
}

const TAP_MAX_MOVE = 6; // px
const TAP_MAX_MS = 500;

/**
 * Khung tương tác dùng chung cho mọi renderer, lấp đầy phần tử cha: kéo để pan, cuộn/pinch để zoom,
 * nút ⟲ để reset, nhấp (tap) phát sự kiện cho renderer.
 *
 * - `insets`: phần diện tích bị giao diện che. Nhân vật được vừa khít và căn giữa trong phần còn lại;
 *   zoom/pan vẫn tính quanh tâm của phần đó.
 * - cssTransform=true (mặc định): khung áp transform CSS lên children (hợp với ảnh tĩnh).
 *   cssTransform=false: children tự áp transform qua useViewerTransform()/useViewerInsets().
 */
export function ViewerStage({
  children,
  cssTransform = true,
  hint,
  backdrop,
  overlay,
  toolbar,
  controlsHidden = false,
  insets = NO_INSETS,
  className = "",
}: {
  children: ReactNode;
  cssTransform?: boolean;
  /** Dòng gợi ý nhỏ ở mép trên khung. */
  hint?: string;
  /** Lớp nền phía sau nhân vật (không bị zoom/pan). */
  backdrop?: ReactNode;
  /** Lớp phủ phía trên (nhãn, phụ đề), không nhận chuột. */
  overlay?: ReactNode;
  /** Nút bổ sung ở thanh công cụ (đứng phía trên các nút zoom). */
  toolbar?: ReactNode;
  /** Ẩn thanh công cụ (ví dụ khi toàn màn hình và đang rảnh tay). */
  controlsHidden?: boolean;
  insets?: Insets;
  /** Kích thước + định vị của khung (ví dụ "absolute inset-0"); mặc định "relative". */
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinch = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const transformRef = useRef<Transform>(INITIAL);
  const insetsRef = useRef<Insets>(insets);
  const tapListeners = useRef<Set<TapListener>>(new Set());
  const tapRef = useRef<{ x: number; y: number; at: number; moved: boolean; multi: boolean } | null>(null);
  const api = useMemo<StageApi>(() => ({ transformRef, insetsRef, tapListeners }), []);
  const [t, setT] = useState<Transform>(INITIAL);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    transformRef.current = t;
  }, [t]);
  const { top, right, bottom, left } = insets;
  useEffect(() => {
    insetsRef.current = { top, right, bottom, left };
  }, [top, right, bottom, left]);

  /** Tâm của vùng còn trống, tính theo toạ độ lệch khỏi tâm khung (px). */
  const centerOffset = () => {
    const i = insetsRef.current;
    return { x: (i.left - i.right) / 2, y: (i.top - i.bottom) / 2 };
  };

  /** Zoom sao cho điểm (px, py) — toạ độ so với tâm vùng còn trống — đứng yên. */
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setT((prev) => {
      const scale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = scale / prev.scale;
      return { scale, x: px - (px - prev.x) * ratio, y: py - (py - prev.y) * ratio };
    });
  }, []);

  /** clientX/Y → toạ độ so với tâm vùng còn trống. */
  const toPivot = (clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect();
    const off = centerOffset();
    return { x: clientX - rect.left - rect.width / 2 - off.x, y: clientY - rect.top - rect.height / 2 - off.y };
  };

  // Listener thủ công với passive:false để chặn cuộn trang khi zoom bằng wheel.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const i = insetsRef.current;
      const rect = el.getBoundingClientRect();
      zoomAt(
        Math.exp(-e.deltaY * 0.0015),
        e.clientX - rect.left - rect.width / 2 - (i.left - i.right) / 2,
        e.clientY - rect.top - rect.height / 2 - (i.top - i.bottom) / 2,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    stageRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPinch.current = null;
    if (pointers.current.size === 1) {
      tapRef.current = { x: e.clientX, y: e.clientY, at: Date.now(), moved: false, multi: false };
    } else if (tapRef.current) {
      tapRef.current.multi = true;
    }
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const tap = tapRef.current;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_MAX_MOVE) tap.moved = true;

    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setT((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const last = lastPinch.current;
      if (last && last.dist > 0) {
        const c = toPivot(mx, my);
        zoomAt(dist / last.dist, c.x, c.y);
        const dx = mx - last.mx;
        const dy = my - last.my;
        setT((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
      }
      lastPinch.current = { dist, mx, my };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    lastPinch.current = null;
    if (pointers.current.size === 0) {
      setDragging(false);
      const tap = tapRef.current;
      tapRef.current = null;
      if (e.type === "pointerup" && tap && !tap.moved && !tap.multi && Date.now() - tap.at < TAP_MAX_MS) {
        tapListeners.current.forEach((l) => l({ clientX: e.clientX, clientY: e.clientY }));
      }
    }
  };

  const reset = () => setT(INITIAL);
  const zoomButton = (factor: number) => zoomAt(factor, 0, 0);

  // Chưa zoom: cho phép vuốt dọc để cuộn trang trên cảm ứng. Đã zoom: nhường toàn bộ cử chỉ cho khung.
  const zoomed = t.scale > 1.02;

  return (
    <div className={`overflow-hidden ${className || "relative"}`}>
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: zoomed ? "none" : "pan-y" }}
        className={`absolute inset-0 select-none overflow-hidden bg-[#05070a] ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {backdrop && <div className="pointer-events-none absolute inset-0">{backdrop}</div>}
        <StageContext.Provider value={api}>
          <div
            className={`absolute will-change-transform ${
              cssTransform ? "transition-[top,right,bottom,left] duration-300 ease-out" : ""
            }`}
            style={
              cssTransform
                ? {
                    top,
                    right,
                    bottom,
                    left,
                    transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
                  }
                : { inset: 0 }
            }
          >
            {children}
          </div>
        </StageContext.Provider>

        {/* Làm tối nhẹ mép khung để chữ và thanh điều khiển nổi lên dễ đọc. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_55%,rgba(0,0,0,0.55))]" />
        {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
        {hint && (
          <p className="pointer-events-none absolute inset-x-0 top-3 hidden px-24 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/30 lg:block">
            {hint}
          </p>
        )}
      </div>

      {/* Thanh công cụ ở mép phải; tự dịch sang trái khi có panel phủ bên phải. */}
      <div
        inert={controlsHidden}
        className={`absolute top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5 transition-[right,opacity] duration-300 ease-out ${
          controlsHidden ? "opacity-0" : "opacity-100"
        }`}
        style={{ right: right + 12 }}
      >
        {toolbar}
        <ToolButton label="Phóng to" onClick={() => zoomButton(1.25)}>+</ToolButton>
        <ToolButton label="Thu nhỏ" onClick={() => zoomButton(0.8)}>−</ToolButton>
        <ToolButton label="Đặt lại góc nhìn" onClick={reset}>⟲</ToolButton>
        <span className="pointer-events-none mt-1 font-mono text-[10px] tracking-widest text-white/45">
          {Math.round(t.scale * 100)}%
        </span>
      </div>
    </div>
  );
}

export function ToolButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  /** Có giá trị thì nút là công tắc (aria-pressed) và sáng màu accent khi bật. */
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`clip-chamfer-sm flex h-9 w-9 items-center justify-center font-display text-lg outline-none backdrop-blur transition hover:bg-accent hover:text-black focus-visible:bg-accent focus-visible:text-black ${
        pressed ? "bg-accent/90 text-black" : "bg-black/50 text-white"
      }`}
    >
      {children}
    </button>
  );
}
