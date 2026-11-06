import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CharacterNav } from "@/components/CharacterNav";
import { CharacterShowcase } from "@/components/CharacterShowcase";
import { CharacterSkeleton } from "@/components/Skeletons";
import { Kbd, Panel, SectionTitle } from "@/components/ui/Panel";
import { getAllCharacters, getCharacterBySlug } from "@/lib/characters";
import { accentStyle, elementColor, rarityColor } from "@/lib/theme";

type Props = PageProps<"/characters/[slug]">;

export function generateStaticParams() {
  return getAllCharacters().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const character = getCharacterBySlug(slug);
  return {
    title: character ? `${character.name} — NIKKE Viewer` : "Không tìm thấy",
  };
}

async function CharacterContent({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const character = getCharacterBySlug(slug);
  if (!character) notFound();

  // Thứ tự prev/next trùng với thứ tự mặc định của gallery (tên A–Z).
  const ordered = [...getAllCharacters()].sort((a, b) => a.name.localeCompare(b.name));
  const i = ordered.findIndex((c) => c.id === character.id);
  const pick = (c?: (typeof ordered)[number]) => (c ? { slug: c.slug, name: c.name } : null);
  const prev = pick(ordered[(i - 1 + ordered.length) % ordered.length]);
  const next = pick(ordered[(i + 1) % ordered.length]);

  const color = elementColor(character.element);
  const unitTag = character.id.replace(/^[a-z0-9]+-/i, "").toUpperCase();
  const stats: { label: string; value?: string; dot?: boolean }[] = [
    { label: "Class", value: character.class },
    { label: "Element", value: character.element, dot: true },
    { label: "Manufacturer", value: character.manufacturer },
    { label: "Weapon", value: character.weapon },
  ];

  const nav = (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/"
        className="clip-chamfer-sm bg-black/50 px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-white/70 outline-none backdrop-blur transition hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        ◂ Gallery
      </Link>
      {ordered.length > 1 && <CharacterNav prev={prev} next={next} />}
    </div>
  );

  // Chữ nổi trực tiếp trên viewer: thêm bóng mờ để luôn đọc được trên mọi nền.
  const identity = (
    <div className="[text-shadow:0_2px_14px_rgba(0,0,0,0.85)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em]">
        {character.rarity && (
          <span
            className="clip-chamfer-sm px-3 py-1 font-display text-sm font-bold tracking-normal text-black text-shadow-none"
            style={{ backgroundColor: rarityColor(character.rarity) }}
          >
            {character.rarity}
          </span>
        )}
        {character.class && <span className="text-accent">{character.class}</span>}
        {character.manufacturer && <span className="text-white/55">{`// ${character.manufacturer}`}</span>}
        <span className="hidden text-white/35 sm:inline">{`· ${unitTag}`}</span>
      </div>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
        {character.name}
      </h1>
      <span aria-hidden className="mt-3 block h-1.5 w-20 skew-x-[-30deg] bg-accent" />
      <ul className="mt-3 hidden flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider sm:flex">
        {character.element && (
          <li className="clip-chamfer-sm flex items-center gap-2 bg-black/45 px-2.5 py-1 text-white/80 backdrop-blur text-shadow-none">
            <span className="h-1.5 w-1.5 rotate-45 bg-accent" />
            {character.element}
          </li>
        )}
        {character.weapon && (
          <li className="clip-chamfer-sm bg-black/45 px-2.5 py-1 text-white/80 backdrop-blur text-shadow-none">
            {character.weapon}
          </li>
        )}
        {character.tags.map((tag) => (
          <li
            key={tag}
            className="clip-chamfer-sm bg-black/45 px-2.5 py-1 text-white/55 backdrop-blur text-shadow-none"
          >
            #{tag}
          </li>
        ))}
      </ul>
    </div>
  );

  const drawer = (
    <>
      <section>
        <SectionTitle>Profile</SectionTitle>
        <p className="border-l-2 border-accent pl-4 leading-relaxed text-white/75">
          {character.description || "Chưa có mô tả."}
        </p>
      </section>

      <section>
        <SectionTitle>Specs</SectionTitle>
        <dl className="grid grid-cols-2 gap-2.5">
          {stats.map(({ label, value, dot }) =>
            value ? (
              <Panel key={label} cut="sm" innerClassName="px-3.5 py-2.5">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</dt>
                <dd className="mt-0.5 flex items-center gap-2 font-display text-base font-semibold tracking-wide">
                  {dot && <span className="h-2 w-2 rotate-45 bg-accent" />}
                  {value}
                </dd>
              </Panel>
            ) : null,
          )}
        </dl>
      </section>

      <section>
        <SectionTitle>Controls</SectionTitle>
        <ul className="space-y-2 text-[13px] text-white/60">
          <li className="flex items-center gap-3">
            <Kbd>Cuộn</Kbd> Zoom tại vị trí con trỏ
          </li>
          <li className="flex items-center gap-3">
            <Kbd>Kéo</Kbd> Di chuyển góc nhìn (hai ngón để zoom)
          </li>
          <li className="flex items-center gap-3">
            <Kbd>Nhấp</Kbd> Chạm vào nhân vật để họ phản ứng
          </li>
          <li className="flex items-center gap-3">
            <Kbd>1–9</Kbd> Chọn animation
          </li>
          <li className="flex items-center gap-3">
            <Kbd>L</Kbd> Bật/tắt phát lặp
          </li>
          <li className="flex items-center gap-3">
            <Kbd>I</Kbd> Mở/đóng thông tin này
          </li>
          <li className="flex items-center gap-3">
            <Kbd>F</Kbd> Toàn màn hình (dock và nút chuyển nhân vật vẫn dùng được)
          </li>
          <li className="flex items-center gap-3">
            <Kbd>B</Kbd> Đổi nền viewer (hoặc dùng nút nền ở cạnh phải)
          </li>
          <li className="flex items-center gap-3">
            <Kbd>P</Kbd> Đổi tư thế: đứng / ngắm / nấp (nếu có)
          </li>
          <li className="flex items-center gap-3">
            <Kbd>← →</Kbd> Chuyển nhân vật
          </li>
        </ul>
      </section>
    </>
  );

  return (
    <main style={accentStyle(color)}>
      <CharacterShowcase character={character} nav={nav} identity={identity} drawer={drawer} />
    </main>
  );
}

// Không `await params` ở cấp trang: truy cập params phải nằm trong <Suspense>
// để phần khung (shell) vẫn được prerender và điều hướng tức thì.
export default function CharacterPage({ params }: Props) {
  return (
    <Suspense fallback={<CharacterSkeleton />}>
      <CharacterContent params={params} />
    </Suspense>
  );
}
