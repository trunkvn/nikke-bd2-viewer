"use client";

import { useEffect, useState } from "react";
import type { Cutscene } from "@/data/types";
import { phaseIndexAt, type CutscenePlan } from "@/lib/bd2Cutscene";
import { CutsceneBackdrop, FX_FPS } from "./CutsceneBackdrop";

/**
 * Nền của tab Ultimate. Đang phát toàn bộ (`startedAt` là mốc `performance.now()` lúc bắt đầu) thì ảnh nền và khung hình hiệu ứng
 * chạy theo thời gian của kế hoạch phát; không thì giữ ảnh nền của pha `staticIndex` (animation đang chọn riêng lẻ).
 */
export function UltimateBackdrop({
  cutscene,
  plan,
  startedAt,
  staticIndex,
}: {
  cutscene: Cutscene;
  plan: CutscenePlan | null;
  startedAt: number | null;
  staticIndex: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const running = plan !== null && startedAt !== null;
  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsed((performance.now() - startedAt) / 1000);
    tick();
    const id = window.setInterval(tick, 1000 / FX_FPS / 2);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  const last = Math.max(0, cutscene.backgrounds.length - 1);
  const idx = running ? Math.min(phaseIndexAt(plan, elapsed), Math.max(0, plan.mainPhases - 1), last) : Math.min(staticIndex, last);
  return <CutsceneBackdrop cutscene={cutscene} bgIndex={idx} fxFrame={running ? Math.floor(elapsed * FX_FPS) : undefined} />;
}
