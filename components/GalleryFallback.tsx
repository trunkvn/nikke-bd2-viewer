import { GALLERY_CHUNK, type CardData } from "@/lib/cards";
import { CharacterCard } from "./CharacterCard";

/**
 * Hiển thị trong lúc Gallery (client) chưa sẵn sàng: render ngay ở server nên các thẻ nằm sẵn trong HTML,
 * người dùng thấy nội dung mà không phải chờ JavaScript. Khi Gallery hydrate xong, lưới thẻ ở trạng thái
 * mặc định (chưa lọc) trông giống hệt nên không bị nhảy bố cục.
 * Khung công cụ chỉ là chỗ giữ vị trí (không tương tác được trong khoảnh khắc này).
 */
export function GalleryFallback({ cards, eagerCount = 6 }: { cards: CardData[]; eagerCount?: number }) {
  // Cùng thứ tự mặc định và cùng số thẻ ban đầu với Gallery, nên lúc chuyển sang bản client lưới không đổi.
  const sorted = [...cards].sort((a, b) => a.name.localeCompare(b.name)).slice(0, GALLERY_CHUNK);
  return (
    <div className="space-y-5" aria-busy="true">
      {/* Chiều cao khớp khung công cụ thật ở từng breakpoint (đã đo) để lúc chuyển sang bản client không bị nhảy bố cục. */}
      <div className="skeleton clip-chamfer h-[142px] md:h-[294px] lg:h-[214px] xl:h-[174px]" />
      <div className="h-4" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sorted.map((c, i) => (
          <CharacterCard key={c.id} card={c} eager={i < eagerCount} />
        ))}
      </div>
    </div>
  );
}
