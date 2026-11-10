import Link from "next/link";
import { GAMES, type GameId } from "@/lib/games";

type Variant = "home" | "nikke" | "bd2" | "azurlane";

const STYLES: Record<Variant, { nav: string; item: string; active: string; idle: string; soon: string }> = {
  // Mỗi trang giữ giọng giao diện của mình: NIKKE chữ mono góc cạnh, BD2 nút bo mềm, trang chủ trung tính.
  nikke: {
    nav: "flex items-center gap-0.5 font-mono text-xs uppercase tracking-widest",
    item: "relative px-2.5 py-2 outline-none transition sm:px-3",
    active: "text-accent after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:bg-accent sm:after:inset-x-3",
    idle: "text-white/65 hover:text-accent focus-visible:text-accent",
    soon: "cursor-not-allowed text-white/25",
  },
  bd2: {
    nav: "flex items-center gap-0.5 text-[13px] font-semibold sm:gap-1 sm:text-sm",
    item: "rounded-[3px_10px_3px_10px] px-2.5 py-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-accent sm:px-3",
    active: "bg-gradient-to-b from-[#f3dc9a] to-[#b98f3e] text-[#2a1c05]",
    idle: "text-muted hover:bg-accent/15 hover:text-accent",
    soon: "cursor-not-allowed text-muted/40",
  },
  azurlane: {
    nav: "flex items-center gap-0.5 text-[13px] font-semibold sm:gap-1 sm:text-sm",
    item: "rounded-[4px_10px_4px_10px] px-2.5 py-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-accent sm:px-3",
    active: "bg-accent text-accent-ink",
    idle: "text-muted hover:bg-accent/15 hover:text-accent",
    soon: "cursor-not-allowed text-muted/40",
  },
  home: {
    nav: "flex items-center gap-0.5 text-[13px] font-semibold sm:gap-1 sm:text-sm",
    item: "rounded-full px-3 py-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-white/70 sm:px-4",
    active: "bg-white text-black",
    idle: "text-white/65 hover:bg-white/10 hover:text-white",
    soon: "cursor-not-allowed text-white/25",
  },
};

/**
 * Thanh tab chuyển giữa trang chủ và các game. Danh sách đọc từ lib/games.ts. Mỗi game có layout gốc riêng nên đổi tab là tải trang mới.
 * Game chưa có dữ liệu (`live: false`) hiện mờ, không bấm được.
 */
export function GameTabs({ current, variant }: { current: GameId | "home"; variant: Variant }) {
  const s = STYLES[variant];
  const items = [{ id: "home" as const, label: "Trang chủ", abbr: "Home", href: "/", live: true }, ...GAMES.map((g) => ({ id: g.id, label: g.short, abbr: g.abbr, href: g.href, live: g.live }))];
  return (
    <nav aria-label="Chuyển game" className={s.nav}>
      {items.map((it) => {
        const text = (
          <>
            <span className="sm:hidden">{it.abbr}</span>
            <span className="hidden sm:inline">{it.label}</span>
          </>
        );
        if (!it.live) {
          return (
            <span key={it.id} aria-disabled="true" title="Sắp có" className={`${s.item} ${s.soon} hidden sm:inline`}>
              {text}
            </span>
          );
        }
        const active = it.id === current;
        return (
          <Link key={it.id} href={it.href} aria-current={active ? "page" : undefined} className={`${s.item} ${active ? s.active : s.idle}`}>
            {text}
          </Link>
        );
      })}
    </nav>
  );
}
