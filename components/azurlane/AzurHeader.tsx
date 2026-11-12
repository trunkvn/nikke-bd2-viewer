import Link from "next/link";
import { GameTabs } from "../GameTabs";
import { ThemeToggle } from "../ThemeToggle";

/** Header của Azur Lane: thanh tối mờ, viền dưới xanh mảnh, logo hình mũi tàu cách điệu (tự vẽ, không dùng logo gốc). */
export function AzurHeader() {
  return (
    <header data-site-header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-5 px-4">
        <Link href="/azurlane" className="group flex items-center gap-2.5 outline-none">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center bg-accent text-accent-ink transition [clip-path:polygon(0_0,100%_0,100%_70%,50%_100%,0_70%)] group-hover:brightness-110"
          >
            <span className="mb-0.5 font-display text-lg font-bold leading-none">A</span>
          </span>
          <span className="hidden whitespace-nowrap font-display text-base font-bold uppercase leading-none tracking-[0.16em] sm:inline">Azur Lane</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <GameTabs current="azurlane" variant="azurlane" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
