import Link from "next/link";

export function SiteHeader() {
  return (
    <header data-site-header className="sticky top-0 z-40 border-b border-white/10 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="group flex items-center gap-3 outline-none">
          {/* Logo mark tự vẽ: ô cắt góc + vạch chéo, không dùng logo gốc của game. */}
          <span
            aria-hidden
            className="clip-chamfer-sm relative flex h-8 w-8 items-center justify-center bg-accent text-black transition group-hover:bg-white group-focus-visible:bg-white"
          >
            <span className="font-display text-lg font-bold leading-none">N</span>
          </span>
          <span className="font-display text-lg font-bold uppercase leading-none tracking-[0.18em]">
            Nikke
            <span className="ml-2 text-xs font-medium tracking-[0.3em] text-white/45">VIEWER</span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 font-mono text-xs uppercase tracking-widest">
          <Link
            href="/"
            className="px-3 py-2 text-white/70 outline-none transition hover:text-accent focus-visible:text-accent"
          >
            Gallery
          </Link>
          <span
            title="Sắp có"
            className="hidden cursor-not-allowed items-center gap-2 px-3 py-2 text-white/25 sm:flex"
          >
            Brown Dust 2
            <span className="clip-chamfer-sm bg-white/10 px-1.5 py-0.5 text-[9px] text-white/50">SOON</span>
          </span>
        </nav>
      </div>
    </header>
  );
}
