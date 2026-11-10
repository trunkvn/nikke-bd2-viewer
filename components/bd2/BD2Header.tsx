import Link from "next/link";
import { GameTabs } from "../GameTabs";

/** Header của Brown Dust 2: thanh trắng mờ, một dòng, viền dưới mảnh. */
export function BD2Header() {
  return (
    <header data-site-header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4">
        <Link href="/bd2" className="group flex items-center gap-2.5 outline-none">
          {/* Dấu hiệu tự vẽ (không dùng logo gốc của game): hình thoi viền vàng, chữ B bên trong. */}
          <span aria-hidden className="relative grid h-8 w-8 place-items-center transition duration-300 group-hover:rotate-[18deg] group-focus-visible:rotate-[18deg]">
            <span className="absolute inset-[3px] rotate-45 rounded-[4px] border border-accent bg-gradient-to-br from-accent/30 to-transparent" />
            <span className="relative font-display text-[17px] font-bold leading-none text-accent">B</span>
          </span>
          <span className="hidden whitespace-nowrap font-display text-base font-bold uppercase leading-none tracking-[0.16em] text-[#fff4d6] sm:inline">Brown Dust 2</span>
        </Link>

        <div className="ml-auto">
          <GameTabs current="bd2" variant="bd2" />
        </div>
      </div>
    </header>
  );
}
