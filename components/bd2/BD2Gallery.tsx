"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { Bd2Card } from "@/lib/bd2Cards";
import { BD2Card } from "./BD2Card";

type Sort = "az" | "new" | "costumes";
const SORTS: { id: Sort; label: string }[] = [
  { id: "az", label: "A → Z" },
  { id: "new", label: "Mới nhất" },
  { id: "costumes", label: "Nhiều trang phục" },
];
const STAR_FILTERS = [5, 4, 3];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Gallery Brown Dust 2: tiêu đề gọn, một hàng bộ lọc và lưới thẻ. */
export function BD2Gallery({ cards }: { cards: Bd2Card[] }) {
  const [query, setQuery] = useState("");
  const [stars, setStars] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("az");
  const [onlyUltimate, setOnlyUltimate] = useState(false);
  const [onlyDating, setOnlyDating] = useState(false);
  const deferred = useDeferredValue(query);

  const totalCostumes = useMemo(() => cards.reduce((n, c) => n + c.costumes, 0), [cards]);
  const ultimateCount = useMemo(() => cards.filter((c) => c.hasUltimate).length, [cards]);
  const datingCount = useMemo(() => cards.filter((c) => c.hasDating).length, [cards]);

  const shown = useMemo(() => {
    const q = normalize(deferred.trim());
    const list = cards.filter(
      (c) =>
        (stars === null || c.stars === stars) &&
        (!onlyUltimate || c.hasUltimate) &&
        (!onlyDating || c.hasDating) &&
        (!q || normalize(c.name).includes(q) || c.costumeNames.some((n) => normalize(n).includes(q))),
    );
    return list.sort((a, b) => {
      if (sort === "new") return b.latest.localeCompare(a.latest) || a.name.localeCompare(b.name);
      if (sort === "costumes") return b.costumes - a.costumes || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [cards, deferred, stars, sort, onlyUltimate, onlyDating]);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:pt-14">
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Characters</h1>
        <p className="text-sm text-muted">
          {cards.length} nhân vật · {totalCostumes} trang phục
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Tìm nhân vật hoặc trang phục</span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên nhân vật hoặc trang phục…"
            className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
          />
        </label>

        <div role="group" aria-label="Lọc theo hạng sao" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={stars === null}
            onClick={() => setStars(null)}
            className="bd2-chip px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Tất cả
          </button>
          {STAR_FILTERS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={stars === n}
              aria-label={`${n} sao`}
              onClick={() => setStars(stars === n ? null : n)}
              className="bd2-chip flex items-center gap-1 px-3 py-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {n}
              <span aria-hidden className="text-[var(--star)]">
                ★
              </span>
            </button>
          ))}
        </div>

        <div role="group" aria-label="Lọc theo nội dung" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={onlyUltimate}
            onClick={() => setOnlyUltimate((v) => !v)}
            title="Chỉ nhân vật có Ultimate (cutscene kỹ năng)"
            className="bd2-chip px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Ultimate <span className="tabular-nums opacity-60">{ultimateCount}</span>
          </button>
          <button
            type="button"
            aria-pressed={onlyDating}
            onClick={() => setOnlyDating((v) => !v)}
            title="Chỉ nhân vật có Fated Guest"
            className="bd2-chip px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Fated Guest <span className="tabular-nums opacity-60">{datingCount}</span>
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only sm:not-sr-only">Sắp xếp</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-xl border border-line bg-panel px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((card, i) => (
            <li key={card.slug}>
              <BD2Card card={card} index={i} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="bd2-card mx-auto max-w-md px-6 py-14 text-center">
          <p className="font-display text-lg font-bold">Không tìm thấy ai cả</p>
          <p className="mt-1 text-sm text-muted">Thử đổi từ khoá hoặc bỏ bớt bộ lọc nhé.</p>
        </div>
      )}
    </main>
  );
}
