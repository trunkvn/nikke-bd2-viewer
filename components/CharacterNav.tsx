"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Neighbor = { slug: string; name: string } | null;

/** Chuyển nhân vật trước/sau; phím ← → cũng dùng được (bỏ qua khi đang gõ vào ô nhập). */
export function CharacterNav({ prev, next }: { prev: Neighbor; next: Neighbor }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft" && prev) router.push(`/nikke/characters/${prev.slug}`);
      if (e.key === "ArrowRight" && next) router.push(`/nikke/characters/${next.slug}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  const cls =
    "clip-chamfer-sm flex items-center gap-2 bg-white/[0.06] px-3 py-2 font-display text-sm font-medium uppercase tracking-wider text-white/75 outline-none transition hover:bg-accent hover:text-black focus-visible:bg-accent focus-visible:text-black";

  return (
    <nav aria-label="Chuyển nhân vật" className="flex items-center gap-2">
      {prev ? (
        <Link href={`/nikke/characters/${prev.slug}`} className={cls} title="Nhân vật trước (←)">
          ◂ <span className="hidden sm:inline">{prev.name}</span>
        </Link>
      ) : null}
      {next ? (
        <Link href={`/nikke/characters/${next.slug}`} className={cls} title="Nhân vật sau (→)">
          <span className="hidden sm:inline">{next.name}</span> ▸
        </Link>
      ) : null}
    </nav>
  );
}
