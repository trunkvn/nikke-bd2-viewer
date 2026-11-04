"use client";

import { useViewerBg } from "@/lib/viewerBg";

/** Nền phía sau nhân vật, theo lựa chọn của người dùng (lưu ở localStorage). */
export function ViewerBackdrop() {
  const { style } = useViewerBg();
  return <div className="absolute inset-0 transition-[background] duration-300" style={style} />;
}
