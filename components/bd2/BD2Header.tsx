import Link from "next/link";
import { GameTabs } from "../GameTabs";

/** Header của Brown Dust 2: thanh trắng mờ, một dòng, viền dưới mảnh. */
export function BD2Header() {
  return (
    <header data-site-header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4">
        <Link href="/bd2" className="group flex items-center gap-2.5 outline-none">
          {/* Dấu hiệu tự vẽ (không dùng logo gốc của game). */}
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-[13px] font-extrabold text-bg transition group-hover:text-white group-focus-visible:text-white group-hover:bg-accent group-focus-visible:bg-accent"
          >
            B
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight">Brown Dust 2</span>
        </Link>

        <div className="ml-auto">
          <GameTabs current="bd2" variant="bd2" />
        </div>
      </div>
    </header>
  );
}
