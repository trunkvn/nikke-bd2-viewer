import Image from "next/image";
import type { Skin } from "@/data/types";

/** Chọn skin dạng dải ảnh nhỏ cho dock: ô 3:4, skin đang chọn có viền accent. Tên skin hiện ở nhãn của dock. */
export function SkinSwitcher({
  skins,
  activeId,
  onSelect,
}: {
  skins: Skin[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Chọn skin"
      className="flex gap-2 overflow-x-auto px-0.5 py-1 [scrollbar-width:none]"
    >
      {skins.map((skin) => {
        const active = skin.id === activeId;
        return (
          <button
            key={skin.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={skin.name}
            title={skin.name}
            onClick={() => onSelect(skin.id)}
            className={`clip-chamfer-sm relative h-14 w-[42px] shrink-0 overflow-hidden outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              active ? "ring-2 ring-inset ring-accent" : "opacity-55 hover:opacity-100"
            }`}
          >
            {skin.thumb && (
              <Image
                src={skin.thumb}
                alt=""
                fill
                unoptimized={skin.thumb.endsWith(".svg")}
                sizes="42px"
                className="object-cover object-top"
              />
            )}
            {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}
