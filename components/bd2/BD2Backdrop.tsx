"use client";

import { useSyncExternalStore } from "react";
import { BD2_DEFAULT_BG, bd2BgOf, bd2BgSetting } from "@/lib/bd2";

/** Nền phía sau nhân vật theo lựa chọn của người dùng (lưu ở localStorage). */
export function BD2Backdrop() {
  const id = useSyncExternalStore(bd2BgSetting.subscribe, bd2BgSetting.get, () => BD2_DEFAULT_BG);
  return <div className="absolute inset-0 transition-[background] duration-500" style={{ background: bd2BgOf(id).background }} />;
}
