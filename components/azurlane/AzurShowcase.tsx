"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getFullscreen, subscribeFullscreen, toggleFullscreen } from "@/lib/fullscreen";
import { voiceEnabledSetting } from "@/lib/voiceSettings";
import { cycleAzurBg } from "@/lib/azurlaneBg";
import { motionLabel, orderCues, rarityStyle, splitMotions, voiceFor, voiceLabel, type AzurShip, type AzurSkin } from "@/lib/azurlaneShared";
import { AzurBackdrop, AzurBackgroundPicker } from "./AzurBackground";
import { FullscreenButton } from "../FullscreenButton";
import { VoiceToggle } from "../VoiceToggle";
import { ViewerStage } from "../ViewerStage";
import { Live2DRenderer, type MotionCommand, type Speech } from "./Live2DRenderer";

type Nav = { slug: string; name: string } | null;

const DRAWER_W = 300;
const desktopQuery = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(desktopQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Trang một tàu: khung viewer Live2D toàn trang, bảng tên, dock chọn trang phục và hoạt cảnh.
 * Chạm (nhấp) vào đầu, người hoặc điểm đặc biệt của tàu để phát motion tương ứng; kéo để di chuyển, cuộn/chụm để phóng to.
 * So sánh: hiện hai trang phục cạnh nhau (A, B), hoạt cảnh bấm ở dock chạy cho cả hai.
 * Vào trang thì tàu chào bằng hoạt cảnh và câu "đăng nhập" (nếu trình duyệt chặn tự phát tiếng thì phát ở cử chỉ đầu tiên).
 * Trang phục và so sánh nằm trên URL (?skin=, ?compare=) nên chia sẻ và tải lại được.
 * Phím: ← → đổi tàu, C đổi trang phục, S so sánh, B đổi nền, I thông tin, F toàn màn hình.
 */
type ShowcaseProps = { ship: AzurShip; prev: Nav; next: Nav };
type UrlState = {
  skinParam?: string | null;
  /** null: không so sánh; chuỗi: id trang phục B ("" = tự chọn). */
  compareParam?: string | null;
  onSkin: (id: string) => void;
  onCompare: (id: string | null) => void;
};

function Showcase({ ship, prev, next, skinParam = null, compareParam = null, onSkin, onCompare }: ShowcaseProps & UrlState) {
  const router = useRouter();
  const skin = ship.skins.find((s) => s.id === skinParam) ?? ship.skins[0];
  const [infoOpen, setInfoOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [command, setCommand] = useState<MotionCommand | null>(null);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const voiceOn = useSyncExternalStore(voiceEnabledSetting.subscribe, () => voiceEnabledSetting.get() !== "off", () => true);
  const hasVoice = !!skin.voice && Object.keys(skin.voice).length > 0;
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

  const compare = compareParam !== null && ship.skins.length > 1;
  const cmpSkin = compare ? (ship.skins.find((s) => s.id === compareParam && s.id !== skin.id) ?? ship.skins.find((s) => s.id !== skin.id) ?? null) : null;
  const toggleCompare = () => onCompare(compare ? null : (ship.skins.find((s) => s.id !== skin.id)?.id ?? null));

  const { main: mainMotions, extra: extraMotions } = splitMotions(skin.motions);

  const play = (name: string) => setCommand((c) => ({ name, nonce: (c?.nonce ?? 0) + 1 }));
  const choose = (id: string) => {
    onSkin(id);
    setPlaying(null);
    setCommand(null);
    setSpeech(null);
  };
  // Mỗi khi một hoạt cảnh bắt đầu (bấm nút, chạm vào nhân vật) thì phát câu thoại tương ứng; idle tự lặp thì không động tới câu đang nói.
  const onMotionStart = (name: string) => {
    setPlaying(name);
    if (name === "idle") return;
    const line = voiceOn ? voiceFor(name, skin.voice) : undefined;
    setSpeech(line ? { src: line.src, text: line.text, nonce: (speech?.nonce ?? 0) + 1 } : null);
  };
  // Tắt tiếng giữa chừng thì câu đang nói dừng ngay (không cần đồng bộ state).
  const activeSpeech = voiceOn ? speech : null;
  const speak = (line: { src: string; text?: string }) => setSpeech({ src: line.src, text: line.text, nonce: (speech?.nonce ?? 0) + 1 });

  // Lời chào khi vào trang: hoạt cảnh "login" (kéo theo câu thoại). Chỉ một lần cho mỗi tàu, đổi trang phục hay so sánh không chào lại.
  const greeted = useRef<string | null>(null);
  const greet = () => {
    if (greeted.current === ship.id) return;
    greeted.current = ship.id;
    if (skin.motions.includes("login")) play("login");
  };
  // Trình duyệt chặn tự phát tiếng (chưa có thao tác nào): phát lại câu đang chờ ở cử chỉ đầu tiên.
  useEffect(() => {
    if (!blocked) return;
    const retry = () => {
      setBlocked(false);
      setSpeech((sp) => (sp ? { ...sp, nonce: sp.nonce + 1 } : sp));
    };
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [blocked]);

  // Luôn gọi bản mới nhất từ phím tắt mà không phải đưa vào deps.
  const toggleCompareRef = useRef(toggleCompare);
  const chooseRef = useRef(choose);
  useEffect(() => {
    toggleCompareRef.current = toggleCompare;
    chooseRef.current = choose;
  });

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
      else if (k === "b") cycleAzurBg();
      else if (k === "i") setInfoOpen((v) => !v);
      else if (k === "s" && skinIds.length > 1) toggleCompareRef.current();
      else if (k === "c" && skinIds.length > 1) chooseRef.current(skinIds[(skinIds.indexOf(skin.id) + 1) % skinIds.length]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, router, skinIds, skin.id]);

  // Vùng còn trống cho nhân vật: tránh dock (trái trên máy tính, dưới trên điện thoại) và cột công cụ bên phải.
  const drawer = infoOpen && !isFullscreen;
  const insets = isDesktop
    ? { top: isFullscreen ? 24 : 70, right: 70 + (drawer ? DRAWER_W + 12 : 0), bottom: 24, left: isFullscreen ? 0 : 430 }
    : { top: isFullscreen ? 24 : 150, right: 60, bottom: 20, left: 0 };
  // Điện thoại: khung viewer dừng ngay trên dock, để thanh công cụ (căn giữa theo chiều dọc) không bị dock che.
  const stageBottom = !isDesktop && !isFullscreen ? dockH : 0;
  // So sánh: một khung, hai mô hình chung một canvas (Live2DRenderer): cạnh nhau trên máy tính, trên/dưới trên điện thoại.
  const layout = isDesktop ? "row" : "column";
  const cmpInsets = !isDesktop && !isFullscreen ? { ...insets, top: 56 } : insets;
  const slotLabel = (tag: string, name: string, i: number) => {
    // Nhãn đặt ở đầu mỗi nửa của vùng còn trống (cùng công thức chia như Live2DRenderer).
    const style: React.CSSProperties = isDesktop
      ? { top: 12, left: `calc(${cmpInsets.left}px + (100% - ${cmpInsets.left + cmpInsets.right}px) * ${(i + 0.5) / 2})`, transform: "translateX(-50%)" }
      : { left: "50%", transform: "translateX(-50%)", top: `calc(${cmpInsets.top}px + (100% - ${cmpInsets.top + cmpInsets.bottom}px) * ${i / 2})` };
    return (
      <span key={tag} className="azl-glass absolute max-w-[40%] truncate px-3 py-1 text-[12px] font-semibold" style={style}>
        <span className="mr-1.5 text-accent">{tag}</span>
        {name}
      </span>
    );
  };
  const chip = "azl-chip px-3 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div data-viewer className="relative h-[calc(100dvh-3.6rem)] min-h-[560px] w-full overflow-hidden bg-bg">
      <div className="absolute inset-x-0 top-0" style={{ bottom: stageBottom }}>
        <ViewerStage
          className="absolute inset-0"
          cssTransform={false}
          insets={compare ? cmpInsets : insets}
          backdrop={<AzurBackdrop />}
          overlay={compare && cmpSkin ? <>{slotLabel("A", skin.name, 0)}{slotLabel("B", cmpSkin.name, 1)}</> : undefined}
          toolbar={
            <>
              {hasVoice && <VoiceToggle enabled={voiceOn} onToggle={() => voiceEnabledSetting.set(voiceOn ? "off" : "on")} />}
              <AzurBackgroundPicker />
              <FullscreenButton active={isFullscreen} onToggle={toggleFullscreen} />
            </>
          }
        >
          <Live2DRenderer
            key={`${skin.model}|${compare && cmpSkin ? cmpSkin.model : ""}`}
            modelUrl={skin.model}
            compareUrl={compare && cmpSkin ? cmpSkin.model : undefined}
            compareLayout={layout}
            label={`${ship.name} — ${skin.name}${compare && cmpSkin ? ` / ${cmpSkin.name}` : ""}`}
            command={command}
            onPlaying={onMotionStart}
            speech={activeSpeech}
            onSpeechEnd={() => setSpeech(null)}
            onSpeechBlocked={() => setBlocked(true)}
            onReady={greet}
          />
        </ViewerStage>
      </div>

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
            <button type="button" aria-expanded={infoOpen} data-active={infoOpen} title="Thông tin (I)" onClick={() => setInfoOpen((v) => !v)} className={chip}>
              Info <span aria-hidden>{infoOpen ? "✕" : "▸"}</span>
            </button>
          </nav>
          <div className={`azl-glass animate-fade-up w-fit max-w-full px-4 py-3 ${compare ? "max-lg:hidden" : ""}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              {ship.hull} · {ship.nation} ·{" "}
              <span style={{ color: rarityStyle(ship.rarity).color }}>{ship.rarity}</span>
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold uppercase leading-none tracking-tight sm:text-5xl">{ship.name}</h1>
            <p className="mt-1.5 text-sm font-medium text-muted">{skin.name}</p>
          </div>
        </div>
      )}

      {activeSpeech?.text && !isFullscreen && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center px-3" style={{ bottom: isDesktop ? 24 : dockH + 24, paddingLeft: isDesktop ? 430 : 12, paddingRight: isDesktop ? 70 : 12 }}>
          <p className="azl-glass max-w-xl px-4 py-2.5 text-center text-sm leading-snug">
            <span className="mr-2 font-display font-semibold uppercase tracking-wider text-accent">{ship.name}</span>
            {activeSpeech.text}
          </p>
        </div>
      )}

      {drawer && (
        <aside
          aria-label="Thông tin tàu"
          className="azl-glass animate-fade-up absolute z-10 overflow-y-auto p-4 max-lg:inset-x-3 max-lg:top-[108px]"
          style={isDesktop ? { right: 72, top: 70, bottom: 24, width: DRAWER_W } : { bottom: dockH + 24 }}
        >
          <InfoPanel ship={ship} skin={skin} voiceOn={voiceOn} onSpeak={speak} />
        </aside>
      )}

      <div className={`absolute inset-x-3 bottom-3 ${isDesktop ? "inset-x-auto left-6 bottom-6 w-[390px]" : ""}`}>
        {isFullscreen ? null : (
          <div ref={dockRef} className="azl-glass max-h-[36dvh] space-y-3 overflow-y-auto p-3 lg:max-h-[46dvh] lg:space-y-4 lg:p-4">
            {ship.skins.length > 1 && (
              <section aria-label="Trang phục">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{compare ? "Trang phục A" : "Trang phục"}</p>
                  <button
                    type="button"
                    aria-pressed={compare}
                    title="So sánh hai trang phục (S)"
                    onClick={toggleCompare}
                    className="azl-chip px-2.5 py-1 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    So sánh
                  </button>
                </div>
                <SkinRow skins={ship.skins} activeId={skin.id} onPick={choose} />
                {compare && cmpSkin && (
                  <>
                    <p className="mb-2 mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Trang phục B</p>
                    <SkinRow skins={ship.skins.filter((x) => x.id !== skin.id)} activeId={cmpSkin.id} onPick={onCompare} />
                  </>
                )}
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

/** Hàng ảnh chọn trang phục. */
function SkinRow({ skins, activeId, onPick }: { skins: AzurShip["skins"]; activeId: string; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {skins.map((s) => (
        <button
          key={s.id}
          type="button"
          title={s.name}
          aria-label={s.name}
          aria-pressed={s.id === activeId}
          onClick={() => onPick(s.id)}
          className={`relative h-[62px] w-[46px] shrink-0 overflow-hidden rounded-md border-2 bg-white/10 outline-none transition focus-visible:ring-2 focus-visible:ring-accent ${
            s.id === activeId ? "border-accent" : "border-transparent opacity-75 hover:opacity-100"
          }`}
        >
          {s.thumb && <Image src={s.thumb} alt="" fill sizes="46px" className="object-cover object-top" />}
        </button>
      ))}
    </div>
  );
}

const KEYS: [string, string][] = [
  ["Nhấp", "Chạm vào đầu, người hoặc điểm đặc biệt để tàu phản ứng và nói"],
  ["Kéo", "Di chuyển góc nhìn (hai ngón để zoom)"],
  ["Cuộn", "Zoom"],
  ["← →", "Chuyển tàu"],
  ["C", "Đổi trang phục"],
  ["S", "So sánh hai trang phục"],
  ["B", "Đổi nền"],
  ["F", "Toàn màn hình"],
  ["I", "Mở/đóng bảng này"],
];

/** Nội dung bảng Info: hồ sơ ngắn, các câu thoại (bấm để nghe) và hướng dẫn thao tác. */
function InfoPanel({ ship, skin, voiceOn, onSpeak }: { ship: AzurShip; skin: AzurSkin; voiceOn: boolean; onSpeak: (line: { src: string; text?: string }) => void }) {
  const names = [ship.names.cn, ship.names.jp, ship.names.kr].filter(Boolean);
  const cues = orderCues(Object.keys(skin.voice ?? {}));
  return (
    <div className="space-y-5">
      <section>
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">{ship.name}</h2>
        {names.length > 0 && <p className="mt-0.5 text-sm text-muted">{names.join(" · ")}</p>}
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {ship.hull} · {ship.nation} · <span style={{ color: rarityStyle(ship.rarity).color }}>{ship.rarity}</span>
          {ship.stars ? ` · ${"★".repeat(ship.stars)}` : ""}
        </p>
        <p className="mt-1 text-xs text-muted">
          {ship.skins.length} trang phục · {skin.motions.length} hoạt cảnh
        </p>
      </section>

      <hr className="border-line" />

      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Lời thoại</h3>
        {cues.length === 0 ? (
          <p className="text-xs text-muted">Trang phục này chưa có voice.</p>
        ) : (
          <ul className="space-y-1.5">
            {cues.map((cue) => {
              const line = skin.voice![cue];
              return (
                <li key={cue}>
                  <button
                    type="button"
                    disabled={!voiceOn}
                    onClick={() => onSpeak(line)}
                    className="azl-chip block w-full px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                  >
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{voiceLabel(cue)}</span>
                    {line.text && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{line.text}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!voiceOn && cues.length > 0 && <p className="mt-2 text-xs text-muted">Voice đang tắt (nút loa ở thanh công cụ).</p>}
      </section>

      <hr className="border-line" />

      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Điều khiển</h3>
        <ul className="space-y-2 text-[13px] text-muted">
          {KEYS.map(([key, text]) => (
            <li key={key} className="flex items-start gap-3">
              <kbd className="mt-px min-w-9 shrink-0 rounded-md border border-line bg-white/10 px-1.5 py-0.5 text-center text-[11px] font-semibold text-foreground">{key}</kbd>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Đọc ?skin= và ?compare= từ URL; đổi chỉ cập nhật URL (replace), không thêm lịch sử và không hỏi lại server. */
function UrlShowcase(props: ShowcaseProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const update = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    // Phải truyền null (đúng như docs): truyền lại history.state của router sẽ khiến Next bỏ qua việc đồng bộ.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };
  const defaultId = props.ship.skins[0].id;
  return (
    <Showcase
      {...props}
      skinParam={searchParams.get("skin")}
      compareParam={searchParams.get("compare")}
      onSkin={(id) => update((p) => (id === defaultId ? p.delete("skin") : p.set("skin", id)))}
      onCompare={(id) => update((p) => (id === null ? p.delete("compare") : p.set("compare", id)))}
    />
  );
}

export function AzurShowcase(props: ShowcaseProps) {
  return (
    // Fallback hiển thị trang phục mặc định trong lúc chờ đọc URL, nên không bị nhảy layout.
    <Suspense fallback={<Showcase {...props} onSkin={() => {}} onCompare={() => {}} />}>
      <UrlShowcase {...props} />
    </Suspense>
  );
}
