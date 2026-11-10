import { AzurGallery } from "@/components/azurlane/AzurGallery";
import { getAllShips, toAzurCard } from "@/lib/azurlane";

export default function AzurLaneHomePage() {
  const cards = getAllShips().map(toAzurCard);
  if (cards.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Chưa có dữ liệu Azur Lane</h1>
        <p className="mt-3 text-muted">
          Xem mục Azur Lane trong README: tải và tách mô hình Live2D rồi chạy <code className="rounded bg-white/10 px-1.5 py-0.5">node scripts/fetch-azurlane.mjs</code>.
        </p>
      </main>
    );
  }
  return <AzurGallery cards={cards} />;
}
