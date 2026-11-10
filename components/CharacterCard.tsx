import Image from "next/image";
import Link from "next/link";
import type { CardData } from "@/lib/cards";
import { accentStyle, elementColor, rarityColor } from "@/lib/theme";
import { CardPreview } from "./CardPreview";
import { Panel } from "./ui/Panel";

/**
 * Thẻ nhân vật. Component thuần (không hook) nên dùng được cả ở server (fallback của gallery, có sẵn trong HTML)
 * lẫn client. `eager` dành cho các thẻ đầu tiên: tải ảnh ngay với ưu tiên cao thay vì chờ lazy-load (tốt cho LCP).
 */
export function CharacterCard({ card, eager = false }: { card: CardData; eager?: boolean }) {
  const color = elementColor(card.element);

  return (
    <Link
      href={`/nikke/characters/${card.slug}`}
      style={accentStyle(color)}
      // content-visibility: trình duyệt bỏ qua layout/paint của thẻ ngoài màn hình (212 thẻ nhưng chỉ vẽ phần đang thấy).
      // Hiệu ứng nhấc thẻ đặt trên chính Link vì paint containment sẽ cắt phần con tràn ra ngoài khung.
      className="group block outline-none transition-transform duration-200 [contain-intrinsic-size:auto_360px] [content-visibility:auto] hover:-translate-y-1 focus-visible:-translate-y-1"
      aria-label={[card.name, card.rarity, card.class].filter(Boolean).join(", ")}
    >
      <Panel
        className="transition-colors duration-200 group-hover:bg-accent group-focus-visible:bg-accent"
        innerClassName="flex flex-col"
      >
        <div className="relative aspect-3/4 overflow-hidden">
          {/* Quầng sáng theo nguyên tố phía sau ảnh có nền trong suốt. */}
          <div className="glow-accent absolute inset-0 opacity-80 transition-opacity group-hover:opacity-100" />
          <div className="bg-grid-sm absolute inset-0 opacity-40" />

          {card.thumb && (
            <Image
              src={card.thumb}
              alt=""
              fill
              // Ảnh WebP của nhân vật qua bộ tối ưu của Next (đúng kích thước hiển thị); SVG giữ nguyên.
              unoptimized={card.thumb.endsWith(".svg")}
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : "auto"}
              sizes="(min-width: 1280px) 236px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover object-top transition duration-500 group-hover:scale-[1.06] group-data-[preview=ready]:opacity-0"
            />
          )}

          {card.preview && <CardPreview render={card.preview} label={card.name} />}

          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-panel via-panel/80 to-transparent" />

          {card.rarity && (
            <span
              className="clip-chamfer-sm absolute left-0 top-0 px-3 py-1 font-display text-sm font-bold text-black"
              style={{ backgroundColor: rarityColor(card.rarity) }}
            >
              {card.rarity}
            </span>
          )}
          {card.hasSpine && (
            <span className="clip-chamfer-sm absolute right-0 top-0 bg-black/70 px-2.5 py-1 font-mono text-[10px] tracking-widest text-cyan backdrop-blur">
              L2D
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="font-display text-xl font-bold uppercase leading-tight tracking-wide">{card.name}</h3>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
              {[card.class, card.weapon].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest">
          <span className="flex items-center gap-2 text-white/70">
            <span className="h-2 w-2 rotate-45 bg-accent" />
            {card.element ?? "—"}
          </span>
          <span className="text-white/35 transition-colors group-hover:text-accent">
            {card.skinCount > 1 ? `${card.skinCount} SKINS` : "VIEW"} ▸
          </span>
        </div>
      </Panel>
    </Link>
  );
}
