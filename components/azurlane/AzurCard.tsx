import Image from "next/image";
import Link from "next/link";
import type { AzurCard } from "@/lib/azurlaneShared";

/** Thẻ tàu: ảnh trên nền xanh có quầng sáng, tên và hệ/loại tàu bên dưới. */
export function AzurShipCard({ card, index }: { card: AzurCard; index: number }) {
  return (
    <Link href={`/azurlane/characters/${card.slug}`} className="group block outline-none">
      <article
        className="azl-card animate-fade-up overflow-hidden group-hover:-translate-y-1 group-focus-visible:border-accent"
        style={{ animationDelay: `${Math.min(index, 14) * 35}ms` }}
      >
        <div className="azl-art relative aspect-[3/4] overflow-hidden">
          {card.thumb && (
            <Image
              src={card.thumb}
              alt=""
              fill
              sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
              loading={index < 10 ? "eager" : "lazy"}
              className="object-cover object-top transition duration-500 group-hover:scale-[1.04]"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg/90 to-transparent" />
          <span className="absolute left-2 top-2 bg-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-accent-ink">L2D</span>
          {card.skins > 1 && (
            <span className="absolute right-5 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">×{card.skins}</span>
          )}
        </div>
        <div className="px-3.5 py-3">
          <h3 className="truncate font-display text-[17px] font-bold uppercase leading-tight tracking-wide">{card.name}</h3>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {card.hull} · {card.nation}
          </p>
        </div>
      </article>
    </Link>
  );
}
