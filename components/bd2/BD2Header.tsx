import Link from "next/link";

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

        <nav className="ml-auto flex items-center gap-1 text-sm font-semibold text-muted">
          <Link href="/bd2" className="rounded-lg px-3 py-1.5 text-foreground outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent">
            Characters
          </Link>
          {/* NIKKE có layout gốc riêng nên chuyển sang đó là tải trang mới. */}
          <Link
            href="/"
            title="Chuyển sang NIKKE"
            className="hidden items-center gap-1 rounded-lg px-3 py-1.5 outline-none transition hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent sm:flex"
          >
            NIKKE <span aria-hidden>↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
