"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { RARITIES, rarityRank, type AzurCard } from "@/lib/azurlaneShared";
import { AzurShipCard } from "./AzurCard";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Query = { q: string; nation: string | null; hull: string | null; rarity: string | null; sort: "name" | "rarity" };
const EMPTY: Query = { q: "", nation: null, hull: null, rarity: null, sort: "name" };

/** Trang danh sách tàu: tìm theo tên, lọc theo hệ (nation), loại tàu (hull) và độ hiếm, sắp theo tên hoặc độ hiếm. Bộ lọc nằm trên URL. */
function Gallery({ cards, initial = EMPTY, onChange }: { cards: AzurCard[]; initial?: Query; onChange?: (q: Query) => void }) {
  const [query, setQuery] = useState(initial.q);
  const [nation, setNation] = useState(initial.nation);
  const [hull, setHull] = useState(initial.hull);
  const [rarity, setRarity] = useState(initial.rarity);
  const [sort, setSort] = useState(initial.sort);
  const deferred = useDeferredValue(query);
  // Ghi bộ lọc lên URL (replace, không thêm lịch sử); bỏ qua lần đầu vì URL đã đúng.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange?.({ q: query, nation, hull, rarity, sort });
  }, [query, nation, hull, rarity, sort, onChange]);

  const nations = useMemo(() => [...new Set(cards.map((c) => c.nation))].sort(), [cards]);
  const hulls = useMemo(() => [...new Set(cards.map((c) => c.hull))].sort(), [cards]);
  // Chỉ hiện các độ hiếm đang có, theo thứ tự thấp đến cao.
  const rarities = useMemo(() => RARITIES.filter((r) => cards.some((c) => c.rarity === r)), [cards]);
  const shown = useMemo(() => {
    const q = normalize(deferred.trim());
    const list = cards.filter((c) => (!nation || c.nation === nation) && (!hull || c.hull === hull) && (!rarity || c.rarity === rarity) && (!q || normalize(c.name).includes(q)));
    return list.sort((a, b) => (sort === "rarity" ? rarityRank(b.rarity) - rarityRank(a.rarity) : 0) || a.name.localeCompare(b.name));
  }, [cards, deferred, nation, hull, rarity, sort]);

  const chip = "azl-chip px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:pt-14">
      <header className="mb-8 flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">
          Azur <span className="text-accent">Lane</span>
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{cards.length} tàu · Live2D</p>
      </header>

      <div className="mb-6 flex flex-col gap-3">
        <label className="relative block max-w-md">
          <span className="sr-only">Tìm tàu</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên tàu…"
            className="w-full rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-medium outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <div role="group" aria-label="Lọc theo độ hiếm" className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={rarity === null} onClick={() => setRarity(null)} className={chip}>
            Mọi độ hiếm
          </button>
          {[...rarities].reverse().map((r) => (
            <button key={r} type="button" aria-pressed={rarity === r} onClick={() => setRarity(rarity === r ? null : r)} className={chip}>
              {r}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Lọc theo hệ" className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={nation === null} onClick={() => setNation(null)} className={chip}>
            Tất cả hệ
          </button>
          {nations.map((n) => (
            <button key={n} type="button" aria-pressed={nation === n} onClick={() => setNation(nation === n ? null : n)} className={chip}>
              {n}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Lọc theo loại tàu" className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={hull === null} onClick={() => setHull(null)} className={chip}>
            Mọi loại tàu
          </button>
          {hulls.map((h) => (
            <button key={h} type="button" aria-pressed={hull === h} onClick={() => setHull(hull === h ? null : h)} className={chip}>
              {h}
            </button>
          ))}
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-muted">
        <span>Sắp xếp</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "name" | "rarity")}
          className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
        >
          <option value="name">Tên A→Z</option>
          <option value="rarity">Độ hiếm cao trước</option>
        </select>
        <span className="ml-auto font-mono text-xs uppercase tracking-[0.18em]">{shown.length} / {cards.length}</span>
      </label>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((card, i) => (
            <li key={card.slug}>
              <AzurShipCard card={card} index={i} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="azl-card mx-auto max-w-md px-6 py-14 text-center">
          <p className="font-display text-lg font-bold uppercase">Không có tàu nào</p>
          <p className="mt-1 text-sm text-muted">Thử đổi từ khoá hoặc bỏ bớt bộ lọc.</p>
        </div>
      )}
    </main>
  );
}

const parse = (p: URLSearchParams): Query => ({
  q: p.get("q") ?? "",
  nation: p.get("nation"),
  hull: p.get("hull"),
  rarity: p.get("rarity"),
  sort: p.get("sort") === "rarity" ? "rarity" : "name",
});

function UrlGallery({ cards }: { cards: AzurCard[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [initial] = useState(() => parse(new URLSearchParams(searchParams.toString())));
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  });
  const [onChange] = useState(() => (q: Query) => {
    const params = new URLSearchParams();
    if (q.q.trim()) params.set("q", q.q.trim());
    if (q.nation) params.set("nation", q.nation);
    if (q.hull) params.set("hull", q.hull);
    if (q.rarity) params.set("rarity", q.rarity);
    if (q.sort !== "name") params.set("sort", q.sort);
    const qs = params.toString();
    // Phải truyền null (đúng như docs): truyền lại history.state của router sẽ khiến Next bỏ qua việc đồng bộ.
    window.history.replaceState(null, "", qs ? `${pathRef.current}?${qs}` : pathRef.current);
  });
  return <Gallery cards={cards} initial={initial} onChange={onChange} />;
}

export function AzurGallery({ cards }: { cards: AzurCard[] }) {
  return (
    // Fallback là bản mặc định (chưa lọc) trong lúc chờ đọc URL, nên không bị nhảy bố cục.
    <Suspense fallback={<Gallery cards={cards} />}>
      <UrlGallery cards={cards} />
    </Suspense>
  );
}
