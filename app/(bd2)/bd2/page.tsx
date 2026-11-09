import { BD2Gallery } from "@/components/bd2/BD2Gallery";
import { getAllCharacters } from "@/lib/characters";
import { toBd2Card } from "@/lib/bd2Cards";

export default function BD2HomePage() {
  const cards = getAllCharacters("bd2").map(toBd2Card);

  if (cards.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Chưa có dữ liệu Brown Dust 2</h1>
        <p className="mt-3 text-muted">
          Chạy <code className="rounded-md bg-white/10 px-1.5 py-0.5">node scripts/fetch-bd2.mjs</code> để tải mô hình và
          dữ liệu nhân vật (asset chỉ dùng local), rồi tải lại trang.
        </p>
      </main>
    );
  }
  return <BD2Gallery cards={cards} />;
}
