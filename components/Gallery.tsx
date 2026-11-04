"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GALLERY_CHUNK, type CardData } from "@/lib/cards";
import {
  FILTER_KEYS,
  applyQuery,
  collectOptions,
  parseQuery,
  serializeQuery,
  type FilterKey,
  type GalleryQuery,
  type SortKey,
} from "@/lib/filters";
import { DEFAULT_ACCENT, accentStyle, elementColor, rarityColor } from "@/lib/theme";
import { CharacterCard } from "./CharacterCard";

// Thẻ không đổi khi lọc/tìm kiếm thì không render lại: chỉ thẻ mới xuất hiện/biến mất mới tốn chi phí.
const MemoCard = memo(CharacterCard);
// Số thẻ đầu tiên tải ảnh ngay (một hàng trên màn rộng) để LCP không phải chờ lazy-load.
const EAGER_CARDS = 6;
import { Panel } from "./ui/Panel";

const FILTER_LABEL: Record<FilterKey, string> = {
  rarity: "Rarity",
  class: "Class",
  element: "Element",
  manufacturer: "Manufacturer",
};

/** Màu riêng cho chip: độ hiếm và nguyên tố có màu, còn lại dùng accent mặc định. */
function chipColor(key: FilterKey, value: string) {
  if (key === "element") return elementColor(value);
  if (key === "rarity") return rarityColor(value);
  return DEFAULT_ACCENT;
}

function Chip({
  label,
  active,
  color,
  dot,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={accentStyle(color)}
      className={`clip-chamfer-sm flex items-center gap-2 px-3 py-1.5 font-display text-sm font-medium tracking-wide outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
        active ? "bg-accent text-black" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.12] hover:text-white"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rotate-45 ${active ? "bg-black" : "bg-accent"}`} />}
      {label}
    </button>
  );
}

const URL_SYNC_DELAY_MS = 250;
const EMPTY_QUERY = parseQuery(new URLSearchParams());

/**
 * Trạng thái tìm kiếm/lọc/sắp xếp.
 * - Nguồn sự thật là state cục bộ nên ô nhập và chip phản hồi tức thì. Trước đây giá trị lấy thẳng từ URL qua router.replace
 *   (chạy trong transition), nên khi render chậm giá trị cũ từ URL ghi đè lên phím vừa gõ và làm MẤT KÝ TỰ.
 * - URL chỉ là bản sao để chia sẻ/tải lại: ghi bằng history.replaceState sau khi ngừng thao tác một lúc.
 * - Nếu URL đổi từ bên ngoài (ví dụ bấm "Gallery" ở header lúc đang lọc) thì đồng bộ ngược vào state.
 */
function useGalleryQuery() {
  const pathname = usePathname();
  const urlQs = useSearchParams().toString();
  const [query, setQuery] = useState(() => parseQuery(new URLSearchParams(urlQs)));
  const [seenUrl, setSeenUrl] = useState(urlQs); // URL lần gần nhất đã xem
  const [writtenUrl, setWrittenUrl] = useState(urlQs); // URL do chính mình ghi lần gần nhất
  const timer = useRef(0);

  if (urlQs !== seenUrl) {
    setSeenUrl(urlQs);
    if (urlQs !== writtenUrl && urlQs !== serializeQuery(query)) setQuery(parseQuery(new URLSearchParams(urlQs)));
  }

  const commit = useCallback(
    (next: GalleryQuery) => {
      setQuery(next);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const qs = serializeQuery(next);
        // Truyền null (đúng như docs Next) để Next đồng bộ với useSearchParams mà không gọi server.
        window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
        setWrittenUrl(qs);
      }, URL_SYNC_DELAY_MS);
    },
    [pathname],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { query, commit };
}

export function Gallery({ cards }: { cards: CardData[] }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { query, commit } = useGalleryQuery();
  const options = useMemo(() => collectOptions(cards), [cards]);
  // Danh sách thẻ dùng giá trị "hoãn": ô nhập và chip phản hồi ngay, còn việc dựng lại lưới thẻ nhường chỗ cho thao tác của người dùng.
  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(() => applyQuery(cards, deferredQuery), [cards, deferredQuery]);
  const stale = deferredQuery !== query;

  // Chỉ dựng một đợt thẻ đầu, cuộn gần tới đáy thì dựng thêm: mỗi lần gõ chỉ phải dựng/gỡ tối đa vài chục thẻ
  // thay vì hàng trăm. Đổi bộ lọc thì quay về đợt đầu.
  const queryKey = serializeQuery(deferredQuery);
  const [shown, setShown] = useState(GALLERY_CHUNK);
  const [shownFor, setShownFor] = useState(queryKey);
  if (shownFor !== queryKey) {
    setShownFor(queryKey);
    setShown(GALLERY_CHUNK);
  }
  const hasMore = shown < visible.length;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    // Tạo lại observer sau mỗi đợt: observe() luôn báo trạng thái hiện tại, nên nếu đáy vẫn còn trong tầm nhìn thì dựng tiếp.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown((n) => n + GALLERY_CHUNK);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, hasMore]);
  // Phím "/" nhảy tới ô tìm kiếm (như nhiều trang tra cứu), trừ khi đang gõ ở chỗ khác.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const update = commit;
  const reset = () => commit(EMPTY_QUERY);

  const toggle = (key: FilterKey, value: string) => {
    const current = query.filters[key];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ ...query, filters: { ...query.filters, [key]: next } });
  };

  const activePills = FILTER_KEYS.flatMap((key) => query.filters[key].map((value) => ({ key, value })));
  const activeCount = activePills.length + (query.q ? 1 : 0);

  return (
    <div className="space-y-5">
      <Panel innerClassName="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Tìm nhân vật</span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={query.q}
              onChange={(e) => update({ ...query, q: e.target.value })}
              placeholder="Tìm theo tên hoặc tag…"
              className="clip-chamfer-sm w-full bg-white/[0.06] py-2.5 pl-10 pr-12 text-sm outline-none transition placeholder:text-white/35 focus:bg-white/[0.1] focus:ring-2 focus:ring-inset focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
            />
            {query.q ? (
              <button
                type="button"
                aria-label="Xoá nội dung tìm kiếm"
                onClick={() => {
                  update({ ...query, q: "" });
                  searchRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-white/50 hover:text-white"
              >
                ✕
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-sm border border-white/20 px-1.5 font-mono text-[11px] text-white/40 sm:block">
                /
              </kbd>
            )}
          </label>

          <div className="flex gap-3">
            <select
              value={query.sort}
              onChange={(e) => update({ ...query, sort: e.target.value as SortKey })}
              aria-label="Sắp xếp"
              className="clip-chamfer-sm flex-1 bg-white/[0.06] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-inset focus:ring-accent sm:flex-none"
            >
              <option value="name">Tên A–Z</option>
              <option value="rarity">Độ hiếm</option>
            </select>
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
              className="clip-chamfer-sm flex items-center gap-2 bg-white/[0.06] px-4 py-2.5 font-display text-sm font-medium tracking-wide md:hidden"
            >
              Bộ lọc{activePills.length > 0 && <span className="text-accent">({activePills.length})</span>}
            </button>
          </div>
        </div>

        <div className={`${filtersOpen ? "grid" : "hidden"} gap-x-10 gap-y-3 md:grid md:grid-cols-2`}>
          {FILTER_KEYS.map((key) =>
            options[key].length === 0 ? null : (
              <div key={key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
                  {FILTER_LABEL[key]}
                </span>
                <div className="flex flex-wrap gap-2">
                  {options[key].map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      color={chipColor(key, value)}
                      dot={key === "element" || key === "rarity"}
                      active={query.filters[key].includes(value)}
                      onClick={() => toggle(key, value)}
                    />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-live="polite">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/50">
          <span className="text-accent">{String(visible.length).padStart(2, "0")}</span>
          {" / "}
          {String(cards.length).padStart(2, "0")} units
        </p>
        {activePills.map(({ key, value }) => (
          <button
            key={`${key}:${value}`}
            type="button"
            onClick={() => toggle(key, value)}
            aria-label={`Bỏ lọc ${FILTER_LABEL[key]} ${value}`}
            className="clip-chamfer-sm flex items-center gap-1.5 bg-white/[0.08] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-white/75 hover:bg-white/15"
          >
            {value} <span className="text-white/40">✕</span>
          </button>
        ))}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[11px] uppercase tracking-wider text-accent underline-offset-4 hover:underline"
          >
            Xoá tất cả
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display text-5xl font-bold uppercase tracking-widest text-white/10 sm:text-7xl">
            No signal
          </p>
          <p className="mt-4 text-white/55">Không có nhân vật nào khớp với bộ lọc hiện tại.</p>
          <button
            type="button"
            onClick={reset}
            className="clip-chamfer-sm mt-6 bg-accent px-5 py-2.5 font-display text-sm font-bold uppercase tracking-widest text-black hover:bg-white"
          >
            Xoá bộ lọc
          </button>
        </div>
      ) : (
        // Không làm mờ cả lưới khi đang cập nhật (stale): đổi opacity của một vùng chứa hàng chục thẻ buộc dựng lại
        // toàn bộ mỗi lần gõ phím, tốn hơn hẳn lợi ích.
        <div aria-busy={stale} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.slice(0, shown).map((c, i) => (
            <MemoCard key={c.id} card={c} eager={i < EAGER_CARDS} />
          ))}
        </div>
      )}
      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
    </div>
  );
}
