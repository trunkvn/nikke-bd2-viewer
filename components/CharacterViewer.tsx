"use client";

import { useEffect, useState } from "react";
import type { Render, Skin } from "@/data/types";
import type { VoiceUi } from "@/lib/useVoice";
import { BackgroundPicker } from "./BackgroundPicker";
import { ImageRenderer } from "./ImageRenderer";
import { SpineRenderer, type PlayCommand, type TapPlan } from "./SpineRenderer";
import { ViewerBackdrop } from "./ViewerBackdrop";
import { ViewerStage, type Insets } from "./ViewerStage";
import { VoiceLangButton, VoiceToggle } from "./VoiceToggle";

/** Một "lớp" nhân vật: một skeleton/ảnh cụ thể (skin + tư thế). Chuyển skin/tư thế = mờ từ lớp này sang lớp khác. */
type LayerDef = { key: string; render: Render; label: string };

type ViewState = {
  /** Lớp hiện tại lần gần nhất, để phát hiện khi chuyển. */
  def: LayerDef;
  /** Lớp cũ đang mờ đi. */
  leaving: LayerDef | null;
  /** Lớp mới đã vẽ khung hình đầu tiên: lúc này lớp cũ mới mờ đi. */
  ready: boolean;
};

const CROSSFADE_MS = 220;

/**
 * Chọn renderer theo loại render của skin/tư thế.
 * ViewerStage không bị remount khi đổi skin/tư thế nên zoom/pan được giữ nguyên. Trong lúc chuyển, lớp cũ được giữ lại
 * cho tới khi lớp mới nạp xong rồi mới mờ đi (crossfade), nên không có khoảnh khắc trống.
 */
export function CharacterViewer({
  skin,
  name,
  className,
  insets,
  captionBottom = 24,
  command,
  onAnimations,
  onPlaying,
  voice,
  toolbarExtra,
  backdrop = <ViewerBackdrop />,
  backgroundPicker = <BackgroundPicker />,
  tapPlan,
  tapEnabled = true,
  speed,
  hiddenSlots,
  onSlots,
  skinName,
  onSkins,
  fitContent,
  pickRest,
}: {
  skin: Skin;
  name: string;
  className?: string;
  /** Phần diện tích bị giao diện che; nhân vật căn giữa trong phần còn lại. */
  insets?: Insets;
  /** Khoảng cách (px) từ đáy khung tới phụ đề/lời nhắc, để chúng nằm phía trên dock. */
  captionBottom?: number;
  command?: PlayCommand | null;
  onAnimations?: (names: string[], durations?: Record<string, number>) => void;
  onPlaying?: (name: string) => void;
  /** Giọng nói của nhân vật; bỏ trống nếu không có file voice. */
  voice?: VoiceUi;
  /** Nút thêm ở thanh công cụ (ví dụ toàn màn hình), đứng dưới các nút voice. */
  toolbarExtra?: React.ReactNode;
  /** Nền phía sau nhân vật; mặc định là nền NIKKE (theo lựa chọn của người dùng). */
  backdrop?: React.ReactNode;
  /** Nút chọn nền ở thanh công cụ; truyền null để ẩn. */
  backgroundPicker?: React.ReactNode;
  /** Tự chọn phản ứng khi nhấp vào nhân vật (xem SpineRenderer). */
  tapPlan?: (names: string[], last: string | null) => TapPlan | null;
  /** false: nhấp vào nhân vật không làm gì (Ultimate, Fated Guest: không phải tư thế đứng nên không có "cử động khi chạm"). */
  tapEnabled?: boolean;
  /** Tốc độ phát animation (1 = bình thường). */
  speed?: number;
  /** Tên các slot (lớp) của skeleton đang ẩn. */
  hiddenSlots?: readonly string[];
  /** Báo danh sách slot của skeleton khi nạp xong. */
  onSlots?: (names: string[]) => void;
  /** Skin bên trong file Spine đang dùng / báo danh sách skin (Fated Guest có nhiều skin). */
  skinName?: string;
  onSkins?: (names: string[]) => void;
  /** Căn khung theo phần hình có nội dung (Fated Guest: bỏ qua các mảng đen che viền). */
  fitContent?: boolean;
  /** Chọn animation làm tư thế nghỉ ban đầu (xem SpineRenderer). */
  pickRest?: (names: string[]) => string | undefined;
}) {
  const { render } = skin;
  const label = `${name} — ${skin.name}`;
  const isImage = render.kind === "image";
  const def: LayerDef = { key: render.kind === "spine" ? render.skel : skin.id, render, label };

  const [view, setView] = useState<ViewState>({ def, leaving: null, ready: false });

  // Điều chỉnh state ngay trong lúc render (cách React khuyến nghị để phản ứng với prop đổi, không cần effect):
  // khi lớp hiện tại đổi sang một lớp khác thì lớp cũ thành "đang rời đi".
  if (view.def.key !== def.key) {
    setView({ def, leaving: view.def, ready: false });
  }

  // Ảnh tĩnh không có bước nạp dài nên coi như sẵn sàng ngay.
  const ready = view.ready || render.kind === "image";

  // Gỡ lớp cũ sau khi mờ xong. Nếu lớp mới mãi không báo sẵn sàng (lỗi nạp) thì vẫn gỡ sau một lúc để khỏi treo.
  useEffect(() => {
    if (!view.leaving) return;
    const t = window.setTimeout(
      () => setView((v) => (v.leaving ? { ...v, leaving: null } : v)),
      ready ? CROSSFADE_MS + 100 : 5000,
    );
    return () => window.clearTimeout(t);
  }, [view.leaving, ready]);

  const markReady = () => setView((v) => (v.def.key === def.key && !v.ready ? { ...v, ready: true } : v));

  // Phụ đề căn theo vùng còn trống (không chui sau dock/ngăn INFO).
  const captionLeft = (insets?.left ?? 0) + 24;
  const captionRight = (insets?.right ?? 0) + 24;

  const layers: { layer: LayerDef; leaving: boolean }[] = [
    ...(view.leaving ? [{ layer: view.leaving, leaving: true }] : []),
    { layer: def, leaving: false },
  ];

  return (
    // Ảnh: stage áp transform CSS. Spine: tự áp qua camera để zoom vẫn sắc nét.
    <ViewerStage
      className={className}
      insets={insets}
      cssTransform={isImage}
      toolbar={
        <>
          {voice?.available && (
            <>
              {voice.lang && voice.langs.length > 1 && (
                <VoiceLangButton lang={voice.lang} langs={voice.langs} onChange={voice.setLang} />
              )}
              <VoiceToggle enabled={voice.enabled} onToggle={voice.toggle} />
            </>
          )}
          {backgroundPicker}
          {toolbarExtra}
        </>
      }
      backdrop={backdrop}
      overlay={
        voice?.caption ? (
          <div className="absolute flex justify-center" style={{ bottom: captionBottom, left: captionLeft, right: captionRight }}>
            <p className="clip-chamfer-sm max-w-md bg-black/75 px-4 py-2.5 text-center text-sm leading-snug backdrop-blur">
              <span className="mr-2 font-display font-semibold uppercase tracking-wider text-accent">{name}</span>
              {voice.caption}
            </p>
          </div>
        ) : voice?.blocked && voice.enabled ? (
          <div className="absolute flex justify-center" style={{ bottom: captionBottom, left: captionLeft, right: captionRight }}>
            <p className="clip-chamfer-sm animate-blink bg-black/75 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              Chạm vào khung để bật giọng nói
            </p>
          </div>
        ) : null
      }
    >
      {/* Mảng có key để lớp cũ giữ nguyên instance khi đổi vai trò từ "hiện tại" sang "đang rời đi" (không bị nạp lại). */}
      {layers.map(({ layer, leaving }) => (
        <div
          key={layer.key}
          aria-hidden={leaving ? true : undefined}
          className={`absolute inset-0 ${leaving ? "transition-opacity" : ""} ${layer.render.kind === "image" ? "animate-skin-in" : ""}`}
          style={leaving ? { opacity: ready ? 0 : 1, transitionDuration: `${CROSSFADE_MS}ms` } : undefined}
        >
          {layer.render.kind === "image" ? (
            <ImageRenderer src={layer.render.src} alt={layer.label} />
          ) : leaving ? (
            <SpineRenderer render={layer.render} label={layer.label} interactive={false} />
          ) : (
            <SpineRenderer
              render={layer.render}
              label={layer.label}
              command={command}
              quietLoading={view.leaving !== null}
              onReady={markReady}
              onAnimations={onAnimations}
              onPlaying={onPlaying}
              speaking={voice?.speaking}
              tapPlan={tapPlan}
              interactive={tapEnabled}
              speed={speed}
              hiddenSlots={hiddenSlots}
              onSlots={onSlots}
              skinName={skinName}
              onSkins={onSkins}
              fitContent={fitContent}
              pickRest={pickRest}
              onTouch={() => voice?.play("touch")}
            />
          )}
        </div>
      ))}
    </ViewerStage>
  );
}
