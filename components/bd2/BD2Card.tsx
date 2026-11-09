import Image from "next/image";
import Link from "next/link";
import type { Bd2Card } from "@/lib/bd2Cards";
import { CardPreview } from "../CardPreview";
import { Stars } from "./Ornaments";

/** Thẻ nhân vật: ảnh nửa người trên nền xám nhạt, tên và trang phục bên dưới. */
export function BD2Card({ card, index }: { card: Bd2Card; index: number }) {
  return (
    <Link
      href={`/bd2/characters/${card.slug}`}
      className="group block rounded-[18px] outline-none [contain-intrinsic-size:auto_380px] [content-visibility:auto]"
    >
      <article
        className="bd2-card animate-fade-up overflow-hidden transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_36px_-18px_rgba(0,0,0,0.8)] group-focus-visible:ring-2 group-focus-visible:ring-accent"
        style={{ animationDelay: `${Math.min(index, 14) * 35}ms` }}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-b from-[#2a2e3c] to-[#1a1c25]">
          <Image
            src={card.thumb}
            alt=""
            fill
            sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
            loading={index < 10 ? "eager" : "lazy"}
            fetchPriority={index < 5 ? "high" : "auto"}
            className="object-cover object-top transition duration-500 group-hover:scale-[1.04] group-data-[preview=ready]:opacity-0"
          />
          {card.preview && <CardPreview render={card.preview} label={`${card.name} — ${card.costume}`} />}
          {card.costumes > 1 && (
            <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
              ×{card.costumes}
            </span>
          )}
          {(card.hasUltimate || card.hasDating) && (
            <span className="absolute bottom-2 left-2 flex gap-1">
              {card.hasUltimate && (
                <span className="rounded-full bg-accent/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                  Ultimate
                </span>
              )}
              {card.hasDating && (
                <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                  Fated
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-2 px-3.5 py-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-bold leading-tight tracking-tight">{card.name}</h3>
            <p className="mt-0.5 truncate text-xs text-muted">{card.costume}</p>
          </div>
          {card.stars ? <Stars value={card.stars} max={card.stars} size={12} className="mt-0.5 shrink-0" /> : null}
        </div>
      </article>
    </Link>
  );
}
