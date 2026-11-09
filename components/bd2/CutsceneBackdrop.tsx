"use client";

import { useEffect, useState } from "react";
import type { Cutscene } from "@/data/types";

/** Nền mặc định khi cutscene không có ảnh nền riêng. */
export const CUTSCENE_FALLBACK_BG =
  "radial-gradient(70% 60% at 50% 40%, rgba(255, 214, 140, 0.55), transparent 70%), linear-gradient(180deg, #2a2559 0%, #6a4b8c 55%, #e4a36a 100%)";

/** Khung hình hiệu ứng phát ở tốc độ này (khung/giây) trong lúc ảnh nền tương ứng đang hiển thị. */
export const FX_FPS = 12;

/**
 * Nền của cutscene: ảnh nền của pha `bgIndex` (các pha khác mờ đi) và các khung hình hiệu ứng (đạn găm, mảnh vụn...) cùng hệ toạ độ
 * phủ lên trên. `fxFrame` do bên ngoài điều khiển (cutscene dạng video theo dõi thời gian của chính nó); bỏ trống thì tự phát liên tục.
 */
export function CutsceneBackdrop({ cutscene, bgIndex, fxFrame }: { cutscene: Cutscene; bgIndex: number; fxFrame?: number }) {
  const bgs = cutscene.backgrounds;
  const fx = bgIndex >= 0 ? (cutscene.effects?.[bgIndex] ?? []) : [];
  const [auto, setAuto] = useState(0);
  const animate = fxFrame === undefined && fx.length > 1;
  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => setAuto((n) => n + 1), 1000 / FX_FPS);
    return () => window.clearInterval(id);
  }, [animate]);
  const frame = fxFrame ?? auto;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: CUTSCENE_FALLBACK_BG }}>
      {bgs.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{ backgroundImage: `url("${src}")`, opacity: i === bgIndex ? 1 : 0 }}
        />
      ))}
      {/* Khung hình hiệu ứng cùng hệ toạ độ với ảnh nền: dùng cùng kiểu phủ để khớp vị trí. */}
      {fx.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${src}")`, opacity: i === frame % fx.length ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
