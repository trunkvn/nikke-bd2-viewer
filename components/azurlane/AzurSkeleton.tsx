/** Khung chờ của trang tàu: hiện trong lúc chuyển trang, cùng kích thước với viewer. */
export function AzurSkeleton() {
  return (
    <main data-viewer aria-busy="true" aria-label="Đang tải" className="relative h-[calc(100dvh-3.6rem)] min-h-[560px] w-full overflow-hidden">
      <div className="skeleton absolute inset-0" />
      <div className="absolute left-6 top-4 space-y-3">
        <div className="skeleton h-9 w-56 rounded-md" />
        <div className="skeleton h-24 w-72 rounded-lg" />
      </div>
      <div className="absolute bottom-5 left-6 w-[390px] max-w-[calc(100%-3rem)]">
        <div className="skeleton h-40 rounded-xl" />
      </div>
    </main>
  );
}
