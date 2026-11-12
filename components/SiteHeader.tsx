import Link from "next/link";
import { GameTabs } from "./GameTabs";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header data-site-header className="sticky top-0 z-40 border-b border-foreground/10 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
        <Link href="/nikke" className="group flex items-center gap-3 outline-none">
          {/* Logo mark tự vẽ: ô cắt góc + vạch chéo, không dùng logo gốc của game. */}
          <span
            aria-hidden
            className="clip-chamfer-sm relative flex h-8 w-8 items-center justify-center bg-accent text-black transition group-hover:bg-foreground group-hover:text-bg group-focus-visible:bg-foreground group-focus-visible:text-bg"
          >
            <span className="font-display text-lg font-bold leading-none">N</span>
          </span>
          <span className="font-display text-lg font-bold uppercase leading-none tracking-[0.18em]">
            Nikke
            <span className="ml-2 hidden text-xs font-medium sm:inline tracking-[0.3em] text-foreground/45">VIEWER</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <GameTabs current="nikke" variant="nikke" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
