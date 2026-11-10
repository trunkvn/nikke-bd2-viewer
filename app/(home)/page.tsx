import { GameCard, type CoverArt, type GameStat } from "@/components/home/GameCard";
import { bd2DefaultSkin, toBd2Card } from "@/lib/bd2Cards";
import { getAllCharacters } from "@/lib/characters";
import { GAMES } from "@/lib/games";

export default function HomePage() {
  const nikke = getAllCharacters("nikke");
  const bd2 = getAllCharacters("bd2");
  const bd2Cards = bd2.map(toBd2Card);

  // Ảnh bìa: NIKKE lấy ba nhân vật SSR đầu theo tên; BD2 lấy ba trang phục mới ra mắt nhất của ba nhân vật khác nhau.
  const nikkeCovers: CoverArt[] = nikke
    .filter((c) => c.rarity === "SSR" && c.skins[0]?.thumb)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((c) => ({ src: c.skins[0].thumb, name: c.name }));
  const bd2Covers: CoverArt[] = bd2
    .map((c) => ({ c, skin: bd2DefaultSkin(c) }))
    .filter(({ skin }) => skin?.thumb)
    .sort((a, b) => (b.skin.released ?? "").localeCompare(a.skin.released ?? ""))
    .slice(0, 3)
    .map(({ c, skin }) => ({ src: skin.thumb, name: c.name }));

  const data: Record<string, { covers: CoverArt[]; stats: GameStat[] }> = {
    nikke: {
      covers: nikkeCovers,
      stats: [
        { label: "nhân vật", value: nikke.length },
        { label: "skin", value: nikke.reduce((n, c) => n + c.skins.length, 0) },
      ],
    },
    bd2: {
      covers: bd2Covers,
      stats: [
        { label: "nhân vật", value: bd2.length },
        { label: "trang phục", value: bd2.reduce((n, c) => n + c.skins.length, 0) },
        { label: "Ultimate", value: bd2Cards.filter((c) => c.hasUltimate).length },
      ],
    },
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:pt-14">
      <section className="mb-8 max-w-3xl sm:mb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-muted">Fan project · Live2D viewer</p>
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          Xem nhân vật game anime,
          <span className="block bg-gradient-to-r from-[#f5d90a] via-[#c9b85a] to-[#8b8bf0] bg-clip-text text-transparent">chạm vào là họ phản ứng.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Chọn một game. Kéo, phóng to, đổi trang phục, nghe giọng nói và xem các cảnh động của từng nhân vật.
        </p>
      </section>

      <section aria-label="Danh sách game" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g, i) => (
          <GameCard key={g.id} game={g} index={i} covers={data[g.id]?.covers ?? []} stats={data[g.id]?.stats ?? []} />
        ))}
      </section>
    </main>
  );
}
