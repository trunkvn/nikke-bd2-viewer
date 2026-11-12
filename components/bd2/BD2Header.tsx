import Link from "next/link";
import { GameTabs } from "../GameTabs";
import { ThemeToggle } from "../ThemeToggle";

/** Header của Brown Dust 2: một dòng, nền mờ, viền dưới mảnh. */
export function BD2Header() {
  return (
    <header data-site-header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4">
        <Link href="/bd2" className="group flex items-center gap-2.5 outline-none">
          {/* Dấu hiệu tự vẽ (không dùng logo gốc của game): hình thoi viền vàng mảnh, chữ B bên trong. */}
          <span aria-hidden className="relative grid h-7 w-7 place-items-center">
            <span className="absolute inset-[4px] rotate-45 rounded-[3px] border border-accent/80 transition group-hover:border-accent" />
            <span className="relative font-display text-[14px] font-semibold leading-none text-accent">B</span>
          </span>
          <span className="hidden whitespace-nowrap font-display text-[15px] font-semibold leading-none tracking-[0.06em] text-foreground transition group-hover:text-accent group-focus-visible:text-accent sm:inline">
            Brown Dust 2
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <GameTabs current="bd2" variant="bd2" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
