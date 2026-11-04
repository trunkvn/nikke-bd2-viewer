import type { ReactNode } from "react";

const CUT = { sm: "clip-chamfer-sm", md: "clip-chamfer", lg: "clip-chamfer-lg" } as const;

/**
 * Khung cắt góc chéo có viền 1px: lớp ngoài tô màu viền (padding 1px), lớp trong tô nền.
 * Đổi màu viền bằng className của lớp ngoài (ví dụ `group-hover:bg-accent`).
 */
export function Panel({
  children,
  cut = "md",
  glass = false,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  cut?: keyof typeof CUT;
  /** Nền bán trong suốt + làm mờ phía sau, dùng cho panel nổi trên viewer. */
  glass?: boolean;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={`${CUT[cut]} bg-white/15 p-px ${className}`}>
      <div className={`${CUT[cut]} ${glass ? "bg-panel/80 backdrop-blur-md" : "bg-panel"} ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}

/** Bốn góc ngoặc kiểu HUD, dùng làm lớp phủ trong khung `relative`. */
export function HudCorners({ className = "" }: { className?: string }) {
  const base = "absolute h-4 w-4 border-accent";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-3 ${className}`}>
      <span className={`${base} left-0 top-0 border-l-2 border-t-2`} />
      <span className={`${base} right-0 top-0 border-r-2 border-t-2`} />
      <span className={`${base} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${base} bottom-0 right-0 border-b-2 border-r-2`} />
    </div>
  );
}

/** Nhãn mục kiểu HUD: thanh accent + chữ mono viết hoa. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="h-3.5 w-1 bg-accent" />
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55">{children}</h2>
      {aside && <span className="ml-auto font-mono text-[11px] text-white/35">{aside}</span>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-white/80">
      {children}
    </kbd>
  );
}
