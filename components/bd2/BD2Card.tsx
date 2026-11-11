import Image from "next/image";
import Link from "next/link";
import type { Bd2Card } from "@/lib/bd2Cards";
import { CardPreview } from "../CardPreview";
import { Stars } from "./Ornaments";

/** Thẻ nhân vật: chỉ ảnh nửa người trong khung viền mảnh, tên và trang phục nằm bên dưới (không nền, không khung); hover sáng viền sang vàng. */
export function BD2Card({ card, index }: { card: Bd2Card; index: number }) {
  return (
    <Link
      href={`/bd2/characters/${card.slug}`}
      className="group block rounded-md outline-none [contain-intrinsic-size:auto_380px] [content-visibility:auto]"
    >
      <article className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 14) * 35}ms` }}>
        <div className="bd2-art relative aspect-[3/4] overflow-hidden group-focus-visible:ring-2 group-focus-visible:ring-accent">
          <Image
            src={card.thumb}
            alt=""
            fill
            sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
            loading={index < 10 ? "eager" : "lazy"}
            fetchPriority={index < 5 ? "high" : "auto"}
            className="object-cover object-top transition duration-500 group-hover:scale-[1.03] group-data-[preview=ready]:opacity-0"
          />
          {card.preview && <CardPreview render={card.preview} label={`${card.name} — ${card.costume}`} />}
          {card.costumes > 1 && (
            <span className="absolute right-1.5 top-1.5 rounded-[3px] bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white/85 backdrop-blur-sm">×{card.costumes}</span>
          )}
          {(card.hasUltimate || card.hasDating) && (
            <span className="absolute bottom-1.5 left-1.5 flex gap-1">
              {card.hasUltimate && <span className="rounded-[3px] bg-black/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/85 backdrop-blur-sm">Ultimate</span>}
              {card.hasDating && <span className="rounded-[3px] bg-black/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/85 backdrop-blur-sm">Fated</span>}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-2 px-0.5 pt-2.5">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-semibold leading-tight text-foreground transition group-hover:text-accent">{card.name}</h3>
            <p className="mt-0.5 truncate text-xs text-muted">{card.costume}</p>
          </div>
          {card.stars ? <Stars value={card.stars} max={card.stars} size={10} className="mt-1 shrink-0 opacity-90" /> : null}
        </div>
      </article>
    </Link>
  );
}
