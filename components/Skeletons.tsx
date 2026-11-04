/** Skeleton cho gallery: cùng lưới và tỉ lệ với card thật để không bị nhảy layout. */
export function GallerySkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải" className="space-y-6">
      <div className="skeleton clip-chamfer h-36" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="skeleton clip-chamfer aspect-[3/4.7]" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton cho trang chi tiết: khung viewer full-bleed cùng chiều cao với trang thật. */
export function CharacterSkeleton() {
  return (
    <main aria-busy="true" aria-label="Đang tải" className="relative h-[calc(100dvh-3.5rem)] min-h-[560px] w-full overflow-hidden">
      <div className="skeleton absolute inset-0" />
      <div className="absolute left-6 top-4 space-y-3">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-5 w-40" />
        <div className="skeleton h-14 w-72" />
      </div>
      <div className="absolute inset-x-6 bottom-5 mx-auto max-w-6xl">
        <div className="skeleton clip-chamfer h-24" />
      </div>
    </main>
  );
}
