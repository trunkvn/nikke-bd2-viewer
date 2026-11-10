import Image from "next/image";
import Link from "next/link";
import type { GameInfo } from "@/lib/games";

export type GameStat = { label: string; value: number };
export type CoverArt = { src: string; name: string };

/** Ba ảnh nhân vật xếp xoè như quân bài; rê chuột vào thẻ thì xoè rộng hơn. */
const FAN = [
  "left-[3%] top-[10%] -rotate-[9deg] group-hover:-translate-x-2 group-hover:-rotate-[13deg]",
  "left-[31%] top-[2%] z-10 group-hover:-translate-y-2",
  "right-[3%] top-[10%] rotate-[9deg] group-hover:translate-x-2 group-hover:rotate-[13deg]",
];

/**
 * Thẻ game trên trang chủ: ảnh nhân vật xếp xoè trên quầng sáng màu nhấn của game, tên, mô tả và số liệu.
 * Component thuần (không hook). Game chưa có dữ liệu (`live: false`) hiện mờ, không bấm được.
 */
export function GameCard({ game, covers, stats, index }: { game: GameInfo; covers: CoverArt[]; stats: GameStat[]; index: number }) {
  const body = (
    <>
      <div
        className="relative h-60 overflow-hidden border-b border-line sm:h-64"
        style={{ background: `radial-gradient(70% 90% at 50% 100%, color-mix(in srgb, ${game.accent} 34%, transparent), transparent 75%)` }}
      >
        {game.live ? (
          covers.slice(0, 3).map((c, i) => (
            <div
              key={c.src}
              className={`absolute aspect-[3/4] w-[38%] overflow-hidden rounded-xl border border-white/15 bg-black/30 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.8)] transition duration-500 ${FAN[i]}`}
            >
              <Image src={c.src} alt={c.name} fill sizes="(min-width: 1024px) 140px, 30vw" className="object-cover object-top" />
            </div>
          ))
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="rounded-full border border-dashed border-white/25 px-4 py-1.5 font-display text-sm tracking-widest text-white/50">SẮP CÓ</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">{game.name}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{game.tagline}</p>
        </div>
        {game.live && (
          <dl className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-2 text-xs text-muted">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <dd className="font-display text-lg font-bold text-foreground">{s.value}</dd>
                <dt>{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
        {game.live && (
          <span className="flex items-center justify-between border-t border-line pt-3 text-sm font-semibold" style={{ color: game.accent }}>
            Mở gallery
            <span aria-hidden className="transition group-hover:translate-x-1">
              →
            </span>
          </span>
        )}
      </div>
    </>
  );

  const base = "group relative flex flex-col overflow-hidden rounded-2xl border bg-panel animate-fade-up";
  const delay = { animationDelay: `${index * 70}ms` };

  if (!game.live) {
    return (
      <div aria-disabled="true" className={`${base} border-dashed border-line opacity-60`} style={delay}>
        {body}
      </div>
    );
  }
  return (
    <Link
      href={game.href}
      className={`${base} border-line outline-none transition duration-300 hover:-translate-y-1 hover:border-[var(--game)] focus-visible:-translate-y-1 focus-visible:border-[var(--game)] focus-visible:ring-2 focus-visible:ring-[var(--game)]`}
      style={{ ...delay, ["--game" as string]: game.accent }}
    >
      {body}
    </Link>
  );
}
