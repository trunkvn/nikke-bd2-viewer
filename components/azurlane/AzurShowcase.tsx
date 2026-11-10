"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getFullscreen, subscribeFullscreen, toggleFullscreen } from "@/lib/fullscreen";
import { motionLabel, rarityStyle, splitMotions, type AzurShip } from "@/lib/azurlaneShared";
import { FullscreenButton } from "../FullscreenButton";
import { ViewerStage } from "../ViewerStage";
import { Live2DRenderer, type MotionCommand } from "./Live2DRenderer";

type Nav = { slug: string; name: string } | null;

const desktopQuery = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(desktopQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Trang một tàu: khung viewer Live2D toàn trang, bảng tên, dock chọn trang phục và hoạt cảnh.
 * Chạm (nhấp) vào đầu, người hoặc điểm đặc biệt của tàu để phát motion tương ứng; kéo để di chuyển, cuộn/chụm để phóng to.
 * Phím: ← → đổi tàu, C đổi trang phục, F toàn màn hình.
 */
export function AzurShowcase({ ship, prev, next }: { ship: AzurShip; prev: Nav; next: Nav }) {
  const router = useRouter();
  const [skinId, setSkinId] = useState(ship.skins[0].id);
  const skin = ship.skins.find((s) => s.id === skinId) ?? ship.skins[0];
  const [playing, setPlaying] = useState<string | null>(null);
  const [command, setCommand] = useState<MotionCommand | null>(null);
  const isDesktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => true);
  const isFullscreen = useSyncExternalStore(subscribeFullscreen, getFullscreen, () => false);

  // Chiều cao thật của dock (đổi theo số chip và cỡ màn hình): nhân vật trên điện thoại luôn nằm phía trên nó.
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(260);
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { main: mainMotions, extra: extraMotions } = splitMotions(skin.motions);

  const play = (name: string) => setCommand((c) => ({ name, nonce: (c?.nonce ?? 0) + 1 }));
  const choose = (id: string) => {
    setSkinId(id);
    setPlaying(null);
    setCommand(null);
  };

  const goPrev = prev?.slug;
  const goNext = next?.slug;
  const skinIds = ship.skins.map((s) => s.id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowLeft" && goPrev) router.push(`/azurlane/characters/${goPrev}`);
      else if (e.key === "ArrowRight" && goNext) router.push(`/azurlane/characters/${goNext}`);
      else if (k === "f") toggleFullscreen();
      else if (k === "c" && skinIds.length > 1) {
        setSkinId(skinIds[(skinIds.indexOf(skin.id) + 1) % skinIds.length]);
        setPlaying(null);
        setCommand(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, router, skinIds, skin.id]);

  // Vùng còn trống cho nhân vật: tránh dock (trái trên máy tính, dưới trên điện thoại) và cột công cụ bên phải.
  const insets = isDesktop
    ? { top: isFullscreen ? 24 : 70, right: 70, bottom: 24, left: isFullscreen ? 0 : 430 }
    : { top: isFullscreen ? 24 : 150, right: 60, bottom: isFullscreen ? 24 : dockH + 24, left: 0 };
  const chip = "azl-chip px-3 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div data-viewer className="relative h-[calc(100dvh-3.6rem)] min-h-[560px] w-full overflow-hidden bg-bg">
      <ViewerStage
        className="absolute inset-0"
        cssTransform={false}
        insets={insets}
        backdrop={<div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_55%_45%,rgba(56,189,248,0.22),transparent_72%),linear-gradient(180deg,#0f2447,#081426)]" />}
        toolbar={<FullscreenButton active={isFullscreen} onToggle={toggleFullscreen} />}
      >
        <Live2DRenderer
          key={skin.model}
          modelUrl={skin.model}
          label={`${ship.name} — ${skin.name}`}
          command={command}
          onPlaying={setPlaying}
        />
      </ViewerStage>

      {!isFullscreen && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-3 sm:left-6 sm:top-4">
          <nav className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            <Link href="/azurlane" className={chip}>
              ◂ Azur Lane
            </Link>
            {prev && (
              <Link href={`/azurlane/characters/${prev.slug}`} title="Tàu trước (←)" className={chip}>
                ◂ <span className="hidden sm:inline">{prev.name}</span>
              </Link>
            )}
            {next && (
              <Link href={`/azurlane/characters/${next.slug}`} title="Tàu sau (→)" className={chip}>
                <span className="hidden sm:inline">{next.name}</span> ▸
              </Link>
            )}
          </nav>
          <div className="azl-glass animate-fade-up w-fit max-w-full px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              {ship.hull} · {ship.nation} ·{" "}
              <span style={{ color: rarityStyle(ship.rarity).color }}>{ship.rarity}</span>
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold uppercase leading-none tracking-tight sm:text-5xl">{ship.name}</h1>
            <p className="mt-1.5 text-sm font-medium text-muted">{skin.name}</p>
          </div>
        </div>
      )}

      <div className={`absolute inset-x-3 bottom-3 ${isDesktop ? "inset-x-auto left-6 bottom-6 w-[390px]" : ""}`}>
        {isFullscreen ? null : (
          <div ref={dockRef} className="azl-glass max-h-[36dvh] space-y-3 overflow-y-auto p-3 lg:max-h-[46dvh] lg:space-y-4 lg:p-4">
            {ship.skins.length > 1 && (
              <section aria-label="Trang phục">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Trang phục</p>
                <div className="flex gap-2">
                  {ship.skins.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.name}
                      aria-label={s.name}
                      aria-pressed={s.id === skin.id}
                      onClick={() => choose(s.id)}
                      className={`relative h-[62px] w-[46px] shrink-0 overflow-hidden rounded-md border-2 bg-white/10 outline-none transition focus-visible:ring-2 focus-visible:ring-accent ${
                        s.id === skin.id ? "border-accent" : "border-transparent opacity-75 hover:opacity-100"
                      }`}
                    >
                      {s.thumb && <Image src={s.thumb} alt="" fill sizes="46px" className="object-cover object-top" />}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section aria-label="Hoạt cảnh">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Hoạt cảnh</p>
              <div className="flex flex-wrap gap-1.5">
                {mainMotions.map((m) => (
                  <button key={m} type="button" data-active={playing === m} onClick={() => play(m)} className={chip}>
                    {motionLabel(m)}
                  </button>
                ))}
              </div>
              {extraMotions.length > 0 && (
                <details className="mt-3 rounded-md border border-line">
                  <summary className="cursor-pointer select-none px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent">
                    Hoạt cảnh mở rộng ({extraMotions.length})
                  </summary>
                  <div className="flex flex-wrap gap-1.5 border-t border-line p-2.5">
                    {extraMotions.map((m) => (
                      <button key={m} type="button" data-active={playing === m} onClick={() => play(m)} className="azl-chip px-2 py-1 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {m}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </section>
            <p className="text-xs leading-relaxed text-muted">Nhấp vào đầu, người hoặc điểm đặc biệt của nhân vật để xem phản ứng. Kéo để di chuyển, cuộn để phóng to.</p>
          </div>
        )}
      </div>
    </div>
  );
}
