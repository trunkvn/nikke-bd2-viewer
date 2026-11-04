"use client";

import { useEffect, useState } from "react";
import type { Pose, Render, Skin } from "@/data/types";
import type { VoiceUi } from "@/lib/useVoice";
import { BackgroundPicker } from "./BackgroundPicker";
import { ImageRenderer } from "./ImageRenderer";
import { SpineRenderer, type PlayCommand } from "./SpineRenderer";
import { ViewerBackdrop } from "./ViewerBackdrop";
import { ViewerStage, type Insets } from "./ViewerStage";
import { VoiceLangButton, VoiceToggle } from "./VoiceToggle";

/** Một "lớp" nhân vật: một skeleton/ảnh cụ thể (skin + tư thế). Chuyển skin/tư thế = chuyển từ lớp này sang lớp khác. */
type LayerDef = { key: string; render: Render; skinId: string; pose: Pose; label: string };

/** Lớp cũ đang rời đi; `outro` là lệnh phát animation "thoát" (nếu có) rồi giữ khung cuối. */
type LeavingLayer = LayerDef & { outro: PlayCommand | null };

type ViewState = {
  /** Key của lớp hiện tại lần gần nhất, để phát hiện khi chuyển. */
  def: LayerDef;
  leaving: LeavingLayer | null;
  /** Animation mở đầu của lớp mới (vào tư thế mới). */
  intro?: string;
  /** Lớp mới đã vẽ khung hình đầu tiên: lúc này lớp cũ mới mờ đi. */
  ready: boolean;
  /**
   * Lớp mới đã được phép nạp. Khi có animation "thoát" thì chờ nó chạy xong rồi mới nạp lớp mới: việc khởi tạo WebGL
   * và biên dịch shader chạy trên luồng chính và làm đứng hình, nên để nó rơi vào lúc lớp cũ đang giữ khung cuối.
   */
  armed: boolean;
};

/**
 * Chuyển giữa hai tư thế chiến đấu (ngắm ↔ nấp) của cùng một skin: skeleton cũ chạy `to_<tư thế mới>` rồi giữ khung cuối,
 * skeleton mới mở đầu bằng chính animation `to_<tư thế mới>` của nó rồi về idle, hai lớp mờ chồng lên nhau.
 * Các trường hợp khác (đổi skin, đứng ↔ ngắm/nấp...) chỉ mờ chồng, vì không có animation chuyển tiếp phù hợp.
 */
function transitionFor(prev: LayerDef, next: LayerDef): { outro: PlayCommand | null; intro?: string } {
  const poseToPose =
    prev.skinId === next.skinId && prev.pose !== next.pose && prev.pose !== "stand" && next.pose !== "stand";
  if (!poseToPose) return { outro: null };
  const anim = `to_${next.pose}`;
  return { outro: { name: anim, nonce: 1, hold: true }, intro: anim };
}

const CROSSFADE_MS = 220;
/** Độ dài animation chuyển tư thế (to_aim/to_cover đều 0.2s) cộng chút dư. */
const OUTRO_MS = 230;

/**
 * Chọn renderer theo loại render của skin/tư thế.
 * ViewerStage không bị remount khi đổi skin/tư thế nên zoom/pan được giữ nguyên. Trong lúc chuyển, lớp cũ được giữ lại
 * cho tới khi lớp mới nạp xong rồi mới mờ đi, nên không có khoảnh khắc trống.
 */
export function CharacterViewer({
  skin,
  pose = "stand",
  name,
  className,
  insets,
  captionBottom = 24,
  command,
  onAnimations,
  onPlaying,
  voice,
  toolbarExtra,
  controlsHidden,
}: {
  skin: Skin;
  /** Tư thế đang xem; dùng để chọn animation chuyển tiếp. `skin.render` đã là render của tư thế này. */
  pose?: Pose;
  name: string;
  className?: string;
  /** Phần diện tích bị giao diện che; nhân vật căn giữa trong phần còn lại. */
  insets?: Insets;
  /** Khoảng cách (px) từ đáy khung tới phụ đề/lời nhắc, để chúng nằm phía trên dock. */
  captionBottom?: number;
  command?: PlayCommand | null;
  onAnimations?: (names: string[]) => void;
  onPlaying?: (name: string) => void;
  /** Giọng nói của nhân vật; bỏ trống nếu không có file voice. */
  voice?: VoiceUi;
  /** Nút thêm ở thanh công cụ (ví dụ toàn màn hình), đứng dưới các nút voice. */
  toolbarExtra?: React.ReactNode;
  controlsHidden?: boolean;
}) {
  const { render } = skin;
  const label = `${name} — ${skin.name}`;
  const isImage = render.kind === "image";
  const def: LayerDef = { key: render.kind === "spine" ? render.skel : skin.id, render, skinId: skin.id, pose, label };

  const [view, setView] = useState<ViewState>({ def, leaving: null, ready: false, armed: true });

  // Điều chỉnh state ngay trong lúc render (cách React khuyến nghị để phản ứng với prop đổi, không cần effect):
  // khi lớp hiện tại đổi sang một lớp khác thì lớp cũ thành "đang rời đi".
  if (view.def.key !== def.key) {
    const t = transitionFor(view.def, def);
    setView({ def, leaving: { ...view.def, outro: t.outro }, intro: t.intro, ready: false, armed: t.outro === null });
  }

  // Ảnh tĩnh không có bước nạp dài nên coi như sẵn sàng ngay.
  const ready = view.ready || render.kind === "image";

  // Có animation thoát: đợi nó chạy xong rồi mới cho lớp mới bắt đầu nạp.
  useEffect(() => {
    if (view.armed) return;
    const t = window.setTimeout(() => setView((v) => (v.armed ? v : { ...v, armed: true })), OUTRO_MS);
    return () => window.clearTimeout(t);
  }, [view.armed]);

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

  const layers: { layer: LayerDef; leaving: LeavingLayer | null }[] = [
    ...(view.leaving ? [{ layer: view.leaving, leaving: view.leaving }] : []),
    ...(view.armed ? [{ layer: def, leaving: null }] : []),
  ];

  return (
    // Ảnh: stage áp transform CSS. Spine: tự áp qua camera để zoom vẫn sắc nét.
    <ViewerStage
      className={className}
      insets={insets}
      cssTransform={isImage}
      controlsHidden={controlsHidden}
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
          <BackgroundPicker />
          {toolbarExtra}
        </>
      }
      backdrop={<ViewerBackdrop />}
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
            <SpineRenderer render={layer.render} label={layer.label} command={leaving.outro} interactive={false} />
          ) : (
            <SpineRenderer
              render={layer.render}
              label={layer.label}
              command={command}
              intro={view.intro}
              quietLoading={view.leaving !== null}
              onReady={markReady}
              onAnimations={onAnimations}
              onPlaying={onPlaying}
              speaking={voice?.speaking}
              onTouch={() => voice?.play("touch")}
            />
          )}
        </div>
      ))}
    </ViewerStage>
  );
}
