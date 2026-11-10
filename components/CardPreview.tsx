"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SpineRender } from "@/data/types";
import { SpineRenderer } from "./SpineRenderer";
import { ViewerStage } from "./ViewerStage";

/** Rê chuột dừng lại chừng này ms mới nạp model (lướt ngang qua thẻ thì không tốn gì). */
const HOVER_DELAY_MS = 220;

/** Chỉ một preview chạy mỗi lúc (mỗi cái giữ một ngữ cảnh WebGL và texture): bật cái mới thì tắt cái đang chạy. */
let stopCurrent: (() => void) | null = null;

/**
 * Xem trước nhân vật ngay trên thẻ: khi rê chuột vào thẻ (Link cha), model Spine hiện lên đè lên ảnh tĩnh và chạy idle,
 * rời chuột thì gỡ. Đặt bên trong khung ảnh của thẻ (khung có `relative`). Không nhận chuột nên nhấp vẫn là mở trang chi tiết.
 * Chỉ bật với chuột (cảm ứng không có hover, và vuốt cuộn trang không được kích hoạt nạp nặng) và khi không yêu cầu giảm chuyển động.
 */
export function CardPreview({ render, label }: { render: SpineRender; label: string }) {
  return (
    <HoverPreview>
      <PreviewSpine render={render} label={label} />
    </HoverPreview>
  );
}

function PreviewSpine({ render, label }: { render: SpineRender; label: string }) {
  const markReady = usePreviewReady();
  return <SpineRenderer render={render} label={label} interactive={false} quietLoading onReady={markReady} />;
}

const ReadyContext = createContext<() => void>(() => {});
/** Cho renderer bên trong HoverPreview: gọi khi khung hình đầu đã vẽ để ảnh tĩnh của thẻ mờ đi. */
export const usePreviewReady = () => useContext(ReadyContext);

/** Phần dùng chung của mọi loại xem trước (Spine, Live2D): lo hover, một preview mỗi lúc, mờ ảnh tĩnh; `children` vẽ model khi cần. */
export function HoverPreview({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  // Khi model đã vẽ xong khung đầu tiên, ảnh tĩnh của thẻ mờ đi (qua data-preview trên thẻ, ảnh có `group-data-[preview=ready]:opacity-0`);
  // nếu không, nhân vật cả người của model chồng lên ảnh nửa người và nhìn như hai nhân vật.
  const markReady = () => {
    const card = hostRef.current?.closest("a");
    if (card) card.dataset.preview = "ready";
  };
  useEffect(() => {
    const card = hostRef.current?.closest("a");
    if (!card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer = 0;
    const stop = () => {
      window.clearTimeout(timer);
      if (stopCurrent === stop) stopCurrent = null;
      delete card.dataset.preview;
      setOn(false);
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        stopCurrent?.();
        stopCurrent = stop;
        setOn(true);
      }, HOVER_DELAY_MS);
    };
    card.addEventListener("pointerenter", onEnter);
    card.addEventListener("pointerleave", stop);
    return () => {
      card.removeEventListener("pointerenter", onEnter);
      card.removeEventListener("pointerleave", stop);
      stop();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      // Khung xem trước trong suốt, không viền tối: ảnh tĩnh phía sau vẫn thấy cho tới khi khung hình đầu của model vẽ xong.
      style={{ "--stage-bg": "transparent", "--stage-vignette": "transparent" } as React.CSSProperties}
    >
      {on && (
        <ViewerStage locked cssTransform={false} className="absolute inset-0">
          <ReadyContext.Provider value={markReady}>{children}</ReadyContext.Provider>
        </ViewerStage>
      )}
    </div>
  );
}
