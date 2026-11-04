import { animationLabel, selectableAnimations } from "@/lib/animations";

/** Chip animation gọn cho dock: tối đa 2 hàng trên desktop (cuộn nếu nhiều hơn), cuộn ngang trên mobile. */
export function AnimationPicker({
  animations,
  current,
  loading = false,
  onSelect,
}: {
  animations: string[];
  current: string | null;
  /** Skin Spine đang tải: giữ chỗ để bố cục không nhảy khi danh sách xuất hiện. */
  loading?: boolean;
  onSelect: (name: string) => void;
}) {
  const list = selectableAnimations(animations);
  if (list.length === 0 && !loading) return null;

  if (list.length === 0) {
    return (
      <div className="flex gap-2" aria-busy="true">
        {[76, 92, 68, 84, 80].map((w) => (
          <div key={w} className="skeleton clip-chamfer-sm h-8" style={{ width: w }} />
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Chọn animation"
      className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:max-h-[32vh] lg:flex-wrap lg:overflow-y-auto lg:overflow-x-visible lg:pb-0"
    >
      {list.map((name, i) => {
        const active = name === current;
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            title={i < 9 ? `${animationLabel(name)} (phím ${i + 1})` : animationLabel(name)}
            onClick={() => onSelect(name)}
            className={`clip-chamfer-sm flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-display text-[13px] font-medium tracking-wide outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              active ? "bg-accent text-black" : "bg-white/[0.07] text-white/80 hover:bg-white/[0.14] hover:text-white"
            }`}
          >
            {active && <span aria-hidden className="animate-blink text-[8px] leading-none">▶</span>}
            {animationLabel(name)}
          </button>
        );
      })}
    </div>
  );
}
