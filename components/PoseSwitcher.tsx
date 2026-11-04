import { POSES, type Pose } from "@/data/types";

export const POSE_LABEL: Record<Pose, string> = { stand: "Đứng", aim: "Ngắm", cover: "Nấp" };

/** Chọn tư thế (đứng / ngắm bắn / nấp) dạng nút chia đều; chỉ liệt kê các tư thế skin này có. */
export function PoseSwitcher({
  available,
  active,
  onSelect,
}: {
  available: Pose[];
  active: Pose;
  onSelect: (pose: Pose) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Chọn tư thế" className="grid flex-1 auto-cols-fr grid-flow-col gap-1.5">
      {POSES.filter((p) => available.includes(p)).map((p, i) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={p === active}
          onClick={() => onSelect(p)}
          title={`${POSE_LABEL[p]} (phím P để đổi)`}
          className={`clip-chamfer-sm px-3 py-1.5 font-display text-[13px] font-medium tracking-wide outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
            p === active ? "bg-accent text-black" : "bg-white/[0.07] text-white/75 hover:bg-white/[0.14] hover:text-white"
          }`}
        >
          {POSE_LABEL[p]}
          <span className="sr-only"> ({i + 1}/{available.length})</span>
        </button>
      ))}
    </div>
  );
}
