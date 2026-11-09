import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BD2Showcase } from "@/components/bd2/BD2Showcase";
import { BD2Skeleton } from "@/components/bd2/BD2Skeleton";
import { getAllCharacters, getCharacterBySlug } from "@/lib/characters";

type Props = PageProps<"/bd2/characters/[slug]">;

export function generateStaticParams() {
  return getAllCharacters("bd2").map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const character = getCharacterBySlug(slug, "bd2");
  return { title: character ? `${character.name} — Brown Dust 2` : "Không tìm thấy" };
}

async function CharacterContent({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const character = getCharacterBySlug(slug, "bd2");
  if (!character) notFound();

  // Thứ tự prev/next trùng với thứ tự mặc định của gallery (tên A–Z), đi vòng tròn.
  const ordered = [...getAllCharacters("bd2")].sort((a, b) => a.name.localeCompare(b.name));
  const i = ordered.findIndex((c) => c.id === character.id);
  const pick = (c?: (typeof ordered)[number]) => (c ? { slug: c.slug, name: c.name } : null);
  const prev = pick(ordered[(i - 1 + ordered.length) % ordered.length]);
  const next = pick(ordered[(i + 1) % ordered.length]);

  return (
    <main>
      <BD2Showcase character={character} prev={prev} next={next} />
    </main>
  );
}

// Không `await params` ở cấp trang: truy cập params phải nằm trong <Suspense>
// để phần khung (shell) vẫn được prerender và điều hướng tức thì.
export default function BD2CharacterPage({ params }: Props) {
  return (
    <Suspense fallback={<BD2Skeleton />}>
      <CharacterContent params={params} />
    </Suspense>
  );
}
