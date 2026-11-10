import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AzurShowcase } from "@/components/azurlane/AzurShowcase";
import { AzurSkeleton } from "@/components/azurlane/AzurSkeleton";
import { getAllShips, getShipBySlug } from "@/lib/azurlane";

type Props = PageProps<"/azurlane/characters/[slug]">;

export function generateStaticParams() {
  return getAllShips().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ship = getShipBySlug(slug);
  return { title: ship ? ship.name : "Không tìm thấy" };
}

async function ShipContent({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const ship = getShipBySlug(slug);
  if (!ship) notFound();

  // Thứ tự prev/next trùng với thứ tự trong gallery (tên A–Z), đi vòng tròn.
  const ordered = [...getAllShips()].sort((a, b) => a.name.localeCompare(b.name));
  const i = ordered.findIndex((s) => s.id === ship.id);
  const pick = (s?: (typeof ordered)[number]) => (s ? { slug: s.slug, name: s.name } : null);
  const prev = ordered.length > 1 ? pick(ordered[(i - 1 + ordered.length) % ordered.length]) : null;
  const next = ordered.length > 1 ? pick(ordered[(i + 1) % ordered.length]) : null;

  return (
    <main>
      <AzurShowcase ship={ship} prev={prev} next={next} />
    </main>
  );
}

// Không `await params` ở cấp trang: truy cập params phải nằm trong <Suspense> để phần khung vẫn được prerender.
export default function AzurLaneShipPage({ params }: Props) {
  return (
    <Suspense fallback={<AzurSkeleton />}>
      <ShipContent params={params} />
    </Suspense>
  );
}
