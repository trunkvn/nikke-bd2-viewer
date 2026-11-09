"use client";

import { useCutsceneAuto } from "@/lib/bd2";

/** Công tắc "Tự phát Ultimate khi vào nhân vật" (lưu trong trình duyệt). */
export function CutsceneAutoSwitch() {
  const [on, toggle] = useCutsceneAuto();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="group mt-2 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-0.5 text-left text-[12px] text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="transition group-hover:text-foreground">
        Tự phát Ultimate khi vào nhân vật
      </span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-white/20"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
