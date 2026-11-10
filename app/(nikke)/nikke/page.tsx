import { Suspense } from "react";
import { Gallery } from "@/components/Gallery";
import { GalleryFallback } from "@/components/GalleryFallback";
import { toCard } from "@/lib/cards";
import { getAllCharacters } from "@/lib/characters";

export default function Home() {
  const characters = getAllCharacters("nikke");
  const skinCount = characters.reduce((n, c) => n + c.skins.length, 0);
  // Chỉ gửi xuống trình duyệt phần dữ liệu cần để vẽ thẻ và lọc (không kèm mô tả, skin, đường dẫn Spine).
  const cards = characters.map(toCard);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:pt-14">
      <header className="relative mb-8 flex flex-col gap-6 sm:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            Archive // Unit database
          </p>
          <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
            <span className="relative inline-block">
              Character Gallery
              <span className="absolute -bottom-1 left-0 h-1.5 w-full -skew-x-[30deg] bg-accent" />
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-white/60">
            Chọn một nhân vật để xem animation, đổi trang phục, phóng to, kéo thả và nhấp vào để tương tác.
          </p>
        </div>
        <dl className="relative flex gap-8 font-mono text-xs uppercase tracking-[0.18em]">
          <div aria-hidden className="stripes absolute -inset-x-6 -inset-y-4 [mask-image:linear-gradient(to_left,#000,transparent)]" />
          <div className="relative">
            <dt className="text-white/40">Units</dt>
            <dd className="font-display text-3xl font-bold tracking-normal text-white">{characters.length}</dd>
          </div>
          <div className="relative">
            <dt className="text-white/40">Skins</dt>
            <dd className="font-display text-3xl font-bold tracking-normal text-white">{skinCount}</dd>
          </div>
        </dl>
      </header>

      <Suspense fallback={<GalleryFallback cards={cards} />}>
        <Gallery cards={cards} />
      </Suspense>
    </main>
  );
}
