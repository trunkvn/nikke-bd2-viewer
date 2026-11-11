"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Character, CutsceneSequence, Skin } from "@/data/types";
import { bd2DefaultSkin } from "@/lib/bd2Cards";
import {
  bd2CutsceneAutoSetting,
  bd2TapPlan,
  classifyAnimations,
  classifyDating,
  cycleBd2Background,
  datingRest,
  faceName,
  naturalSort,
  type Bd2Category,
} from "@/lib/bd2";
import { buildSequencePlan, phaseOfAnimation, planCutscene, restAnimation, singleAnimationPlan, type CutscenePlan } from "@/lib/bd2Cutscene";
import { getFullscreen, subscribeFullscreen, toggleFullscreen } from "@/lib/fullscreen";
import { useMedia } from "@/lib/useMedia";
import { useVoice } from "@/lib/useVoice";
import { CharacterViewer } from "../CharacterViewer";
import { FullscreenButton } from "../FullscreenButton";
import type { PlayCommand } from "../SpineRenderer";
import type { Insets } from "../ViewerStage";
import { BD2Backdrop } from "./BD2Backdrop";
import { BD2BackgroundPicker } from "./BD2BackgroundPicker";
import { BD2Layers } from "./BD2Layers";
import { CutsceneAutoSwitch } from "./CutsceneAutoSwitch";
import { UltimateBackdrop } from "./UltimateBackdrop";
import { Stars } from "./Ornaments";

type Neighbor = { slug: string; name: string } | null;

const DESKTOP_QUERY = "(min-width: 1024px)";
const WIDE_QUERY = "(min-width: 1280px)";
const DRAWER_WIDTH = 360;
const DOCK_WIDTH = 420;

/**
 * Mọi trạng thái gắn với một "khung nhìn" (trang phục + chế độ xem) đều mang `viewKey`; đổi trang phục hay chế độ thì trạng thái
 * cũ tự mất hiệu lực mà không cần xoá.
 */
type AnimState = { viewKey: string; list: string[]; durations: Record<string, number>; current: string | null };
type Keyed<T> = { viewKey: string } & T;

const CATEGORY_LABEL: Record<Bd2Category, string> = { character: "Nhân vật", ultimate: "Ultimate", dating: "Fated Guest" };
/** Lớp biểu cảm khuôn mặt đang chồng lên idle (track 1). */
type OverlayState = { viewKey: string; face: number | null; talk: boolean };

/** Đồng hồ cho các hàm xử lý sự kiện (tách ra ngoài component để không bị coi là gọi hàm không thuần khiết lúc render). */
const nowMs = () => performance.now();

const formatDate = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric" });
};

function Showcase({
  character,
  prev,
  next,
  skinId,
  onSelect,
  autoplay = false,
}: {
  character: Character;
  prev: Neighbor;
  next: Neighbor;
  skinId?: string | null;
  onSelect: (id: string) => void;
  /** Cho phép tự mở Ultimate và phát khi vào nhân vật (chỉ bản chính, không phải khung chờ của Suspense). */
  autoplay?: boolean;
}) {
  const router = useRouter();
  const defaultSkin = bd2DefaultSkin(character);
  const skin = character.skins.find((s) => s.id === skinId) ?? defaultSkin;
  // Chế độ xem: đứng (mô hình thường) / Ultimate (cutscene kỹ năng, chọn từng animation) / Fated Guest (tranh hẹn hò). Gắn với
  // trang phục: đổi trang phục thì về chế độ đứng; chế độ trang phục không có thì cũng về chế độ đứng.
  const [catRaw, setCatRaw] = useState<{ skinId: string; cat: Bd2Category }>({ skinId: "", cat: "character" });
  const wanted = catRaw.skinId === skin.id ? catRaw.cat : "character";
  const category: Bd2Category =
    (wanted === "ultimate" && skin.cutscene) || (wanted === "dating" && skin.dating) ? wanted : "character";
  const viewKey = `${skin.id}:${category}`;
  const setCategory = (cat: Bd2Category) => setCatRaw({ skinId: skin.id, cat });
  const viewSkin: Skin =
    category === "ultimate" && skin.cutscene
      ? { ...skin, render: skin.cutscene }
      : category === "dating" && skin.dating
        ? { ...skin, render: skin.dating }
        : skin;
  const voice = useVoice(skin.voice, skin.id);
  const isDesktop = useMedia(DESKTOP_QUERY, true);
  const isWide = useMedia(WIDE_QUERY, true);
  const isFullscreen = useSyncExternalStore(subscribeFullscreen, getFullscreen, () => false);

  const [anim, setAnim] = useState<AnimState | null>(null);
  const [overlayRaw, setOverlay] = useState<OverlayState | null>(null);
  const [command, setCommand] = useState<PlayCommand | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"info" | "layers">("info");
  const [speed, setSpeed] = useState(1);
  const [plateOn, setPlateOn] = useState(false); // Ultimate: dùng ảnh nền của cutscene (mặc định tắt, dùng nền đang chọn)
  const [slotsRaw, setSlots] = useState<Keyed<{ names: string[] }> | null>(null);
  const [hiddenRaw, setHidden] = useState<Keyed<{ names: string[] }> | null>(null);
  const [skinsRaw, setSkins] = useState<Keyed<{ names: string[] }> | null>(null);
  // So sánh hai trang phục: bật thì thêm một khung thứ hai (trang phục B) cạnh khung chính; mọi lệnh phát animation gửi cho cả hai.
  const [compareOn, setCompareOn] = useState(false);
  const [cmpId, setCmpId] = useState<string | null>(null);
  const [pickRaw, setPick] = useState<Keyed<{ skinName?: string; name: string | null; scene: number | null }> | null>(null);
  // Phát toàn bộ Ultimate (các pha A → B → C rồi giữ đoạn lặp cuối) ngay trong viewer; `startedAt` là mốc để nền chạy theo.
  const [seq, setSeq] = useState<Keyed<{ plan: CutscenePlan; startedAt: number; label: string }> | null>(null);
  const canCompare = category === "character" && character.skins.length > 1;
  const compare = compareOn && canCompare;
  const cmpSkin = compare ? (character.skins.find((s) => s.id === cmpId && s.id !== skin.id) ?? character.skins.find((s) => s.id !== skin.id) ?? null) : null;
  const hasUltimate = !!skin.cutscene;
  // Chuỗi chỉnh tay "cut_all" (nếu có) là "Phát toàn bộ"; các chuỗi còn lại hiện thành chip riêng. Không có thì dùng kế hoạch tự động.
  const sequences = skin.cutscene?.sequences ?? [];
  const defaultSequence = sequences.find((q) => q.name === "cut_all") ?? sequences[0];
  const otherSequences = sequences.filter((q) => q !== defaultSequence);
  // Vào một nhân vật có Ultimate thì tự chuyển sang tab Ultimate và phát toàn bộ (trừ khi người dùng đã tắt). Mỗi nhân vật chỉ một
  // lần: đổi trang phục sau đó không làm nó tự phát lại.
  const autoFor = useRef<string | null>(null);
  const autoPending = useRef<string | null>(null); // viewKey đang chờ mô hình nạp xong để phát
  useEffect(() => {
    if (!autoplay || autoFor.current === character.id) return;
    // Đặt lịch thay vì setState ngay trong effect; đánh dấu "đã tự phát" ở trong callback để StrictMode (chạy effect hai lần
    // ở dev) không làm mất lần tự phát.
    const t = window.setTimeout(() => {
      autoFor.current = character.id;
      if (hasUltimate && bd2CutsceneAutoSetting.get() === "on") {
        autoPending.current = `${skin.id}:ultimate`;
        setCatRaw({ skinId: skin.id, cat: "ultimate" });
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [autoplay, character.id, hasUltimate, skin.id]);
  const active = anim?.viewKey === viewKey ? anim : null;
  const overlay = overlayRaw?.viewKey === viewKey ? overlayRaw : { viewKey, face: null, talk: false };
  const { body, faces, talkFaces } = classifyAnimations(active?.list ?? []);
  const names = active?.list ?? [];
  const slots = slotsRaw?.viewKey === viewKey ? slotsRaw.names : [];
  const hidden = hiddenRaw?.viewKey === viewKey ? hiddenRaw.names : [];
  const spineSkins = skinsRaw?.viewKey === viewKey ? skinsRaw.names : [];
  const pick = pickRaw?.viewKey === viewKey ? pickRaw : null;
  // Fated Guest mở bằng skin "default" của file Spine (các skin `idleN_k` là biến thể riêng); các chế độ khác để renderer tự chọn.
  const spineSkin = pick?.skinName ?? (category === "dating" ? "auto" : undefined);
  const setPickPart = (part: Partial<{ skinName?: string; name: string | null; scene: number | null }>) =>
    setPick({ viewKey, skinName: pick?.skinName, name: pick?.name ?? null, scene: pick?.scene ?? null, ...part });
  const dating = category === "dating" ? classifyDating(names) : null;
  const ultimateNames = category === "ultimate" ? [...names].sort(naturalSort) : [];
  const plan = category === "ultimate" && active ? planCutscene(active.list, active.durations) : null;
  const seqActive = category === "ultimate" && seq?.viewKey === viewKey ? seq : null;

  const send = (name: string, opts: { track?: number; loop?: boolean; base?: string; then?: string; from?: string } = {}) =>
    setCommand((c) => ({ name, nonce: (c?.nonce ?? 0) + 1, ...opts }));

  /** Ultimate: phát RIÊNG một animation của cutscene (lặp mãi) cùng các lớp phụ của nó. */
  const playUltimate = (name: string) => {
    setSeq(null);
    setPickPart({ name });
    setCommand((c) => ({ name: "", nonce: (c?.nonce ?? 0) + 1, plan: singleAnimationPlan(names, name) }));
  };

  /** Ultimate: phát toàn bộ theo kế hoạch tự động (các pha nối nhau, kết thúc bằng đoạn lặp cuối). */
  const playSequence = (sequence: CutsceneSequence | undefined, list: string[], durations: Record<string, number>) => {
    const p = sequence ? buildSequencePlan(sequence, list, durations) : planCutscene(list, durations);
    if (!p) return;
    setPickPart({ name: null });
    setSeq({ viewKey, plan: p, startedAt: nowMs(), label: sequence?.name ?? "" });
    setCommand((c) => ({ name: "", nonce: (c?.nonce ?? 0) + 1, plan: p.steps }));
  };
  const playAll = (list: string[], durations: Record<string, number>) => {
    playSequence(defaultSequence, list, durations);
  };

  /** Fated Guest: chạy `name` chồng lên cảnh nền `base` (`idleN`); tên trùng `base` thì chỉ chạy cảnh nền. */
  const playDating = (name: string, base: string, scene: number | null) => {
    setPickPart({ name: name === base ? null : name, scene });
    send(name, { track: 1, base, loop: /loop$/i.test(name) || name === base });
  };

  /**
   * Fated Guest: `motionN_k` là chuyển động đi từ cảnh N sang cảnh N+1. Chạy một lần rồi dừng ở `idle(N+1)`, và cảnh đang chọn
   * (danh sách "Chạm / hoạt cảnh" bên dưới) đổi theo sang N+1. Không có cảnh N+1 thì chạy lặp như animation lẻ.
   */
  const playMotion = (name: string) => {
    const n = Number(/^motion(\d+)_/.exec(name)?.[1]);
    const from = dating?.scenes.find((sc) => sc.n === n);
    const to = dating?.scenes.find((sc) => sc.n === n + 1);
    if (!from?.idle || !to?.idle) return playDating(name, name, null);
    setPickPart({ name, scene: to.n });
    send(name, { then: to.idle, from: from.idle });
  };

  /** Chuyển động toàn thân: idle lặp mãi, các chuyển động khác chạy một lần rồi về idle. */
  const playBody = (name: string) => send(name, { loop: name === "idle" });

  /** Áp biểu cảm (và nhép miệng nếu bật) lên track chồng. Không chọn biểu cảm mà bật nhép miệng thì dùng nét mặt 0. */
  const applyOverlay = (face: number | null, talk: boolean) => {
    setOverlay({ viewKey, face, talk });
    if (face === null && !talk) return send("", { track: 1 });
    const n = face ?? faces[0] ?? 0;
    send(faceName(n, talk && talkFaces.has(n)), { track: 1, loop: true });
  };

  // Phím tắt: ← → chuyển nhân vật, I thông tin, F toàn màn hình, B đổi nền, C đổi trang phục.
  const goPrev = prev?.slug;
  const goNext = next?.slug;
  const skinIds = character.skins.map((s) => s.id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowLeft" && goPrev) router.push(`/bd2/characters/${goPrev}`);
      else if (e.key === "ArrowRight" && goNext) router.push(`/bd2/characters/${goNext}`);
      else if (k === "i") setInfoOpen((v) => !v);
      else if (k === "f") toggleFullscreen();
      else if (k === "b") cycleBd2Background();
      else if (k === "s" && skinIds.length > 1) setCompareOn((v) => !v);
      else if (k === "c" && skinIds.length > 1) onSelect(skinIds[(skinIds.indexOf(skin.id) + 1) % skinIds.length]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, router, skin.id, skinIds, onSelect]);

  // Đo chiều cao dock để chừa chỗ cho nhân vật và đặt phụ đề phía trên nó.
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(0);
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setDockH(Math.round(entry.target.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drawerOnSide = isDesktop && infoOpen;
  // Desktop: dock ở góc dưới-trái. Chỉ chừa chiều ngang bên trái khi màn hình hẹp hoặc khi ngăn INFO đẩy nhân vật
  // về phía dock, để chân nhân vật không chui sau dock. Mobile: dock là dải ngang ở đáy.
  const leftInset = isDesktop && (drawerOnSide || !isWide) ? DOCK_WIDTH + 16 : 0;
  // So sánh: hai khung nằm trên dock (desktop: trái/phải; điện thoại: trên/dưới); dock chuyển xuống giữa đáy trang.
  const cmpBottom = dockH + 16;
  // Điện thoại: hai khung xếp dọc, thanh công cụ của khung trên chỉ giữ nút zoom (nút voice/nền/toàn màn hình không đủ chỗ).
  const slim = compare && !isDesktop;
  const LABEL = 76; // nhãn + hàng ảnh chọn trang phục B; hai khung dùng cùng khoảng này để nhân vật cùng cỡ
  const paneTop = (second: boolean) => (!second || isDesktop ? 52 : 8) + LABEL;
  const paneInsets = (second: boolean): Insets => ({
    top: paneTop(second),
    left: 0,
    right: second && drawerOnSide ? DRAWER_WIDTH + 24 : 0,
    bottom: 4,
  });
  const paneStyle = (second: boolean): React.CSSProperties => {
    const region = `calc(100% - ${cmpBottom}px)`;
    if (isDesktop) return { top: 0, bottom: cmpBottom, [second ? "right" : "left"]: 0, width: "50%" };
    return { left: 0, right: 0, height: `calc(${region} / 2)`, top: second ? `calc(${region} / 2)` : 0 };
  };
  const insets: Insets = isDesktop
    ? { top: 8, left: leftInset, right: drawerOnSide ? DRAWER_WIDTH + 24 : 0, bottom: 12 }
    : { top: isFullscreen ? 64 : 126, left: 0, right: 0, bottom: dockH + 22 };

  const chip = "bd2-chip px-3.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const itemChip = "bd2-chip shrink-0 px-3 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const sceneN = pick?.scene ?? dating?.scenes[0]?.n ?? null;
  /** `motionN_k` có cảnh đích N+1 thì là chuyển cảnh: nhãn "N → N+1" cho dễ hiểu. */
  const isMotion = (n: string) => {
    const from = Number(/^motion(\d+)_/.exec(n)?.[1]);
    return !!dating?.scenes.find((sc) => sc.n === from)?.idle && !!dating?.scenes.find((sc) => sc.n === from + 1)?.idle;
  };
  const motionLabel = (n: string) => (isMotion(n) ? `Cảnh ${Number(/^motion(\d+)_/.exec(n)![1])} → ${Number(/^motion(\d+)_/.exec(n)![1]) + 1}` : n);
  const scene = dating?.scenes.find((sc) => sc.n === sceneN) ?? null;

  return (
    <div data-viewer className="relative h-[calc(100dvh-3.6rem)] min-h-[560px] w-full overflow-hidden bg-bg">
      <div className="absolute" style={compare ? paneStyle(false) : { inset: 0 }}>
        <CharacterViewer
          className="absolute inset-0"
          skin={viewSkin}
          name={character.name}
          insets={compare ? paneInsets(false) : insets}
          captionBottom={24}
          command={command}
          voice={category === "character" && !slim ? voice : undefined}
          backdrop={
            category === "ultimate" && skin.cutscene && plateOn && skin.cutscene.backgrounds.length > 0 ? (
              <UltimateBackdrop
                cutscene={skin.cutscene}
                plan={seqActive ? seqActive.plan : null}
                startedAt={seqActive ? seqActive.startedAt : null}
                staticIndex={phaseOfAnimation(plan, pick?.name ?? active?.current ?? "")}
              />
            ) : (
              <BD2Backdrop />
            )
          }
          backgroundPicker={slim ? null : <BD2BackgroundPicker />}
          tapPlan={bd2TapPlan}
          tapEnabled={category === "character"}
          speed={speed}
          hiddenSlots={hidden}
          skinName={spineSkin}
          fitContent={category === "dating"}
          pickRest={category === "ultimate" ? restAnimation : category === "dating" ? datingRest : undefined}
          toolbarExtra={slim ? undefined : <FullscreenButton active={isFullscreen} onToggle={toggleFullscreen} />}
          onAnimations={(list, durations) => {
            setAnim({ viewKey, list, durations: durations ?? {}, current: null });
            if (autoPending.current === viewKey) {
              autoPending.current = null;
              playAll(list, durations ?? {});
            }
          }}
          onSlots={(names) => setSlots({ viewKey, names })}
          onSkins={(names) => setSkins({ viewKey, names })}
          onPlaying={(name) => setAnim((a) => (a && a.viewKey === viewKey ? { ...a, current: name } : a))}
        />
        {compare && (
          <div className="pointer-events-none absolute inset-x-0 top-[52px] flex justify-center">
            <span className="bd2-glass max-w-[80%] truncate px-3 py-1 text-[12px] font-semibold">
              <span className="mr-1.5 text-muted">A</span>
              {skin.name}
            </span>
          </div>
        )}
      </div>

      {compare && cmpSkin && (
        <div className="absolute" style={paneStyle(true)}>
          <CharacterViewer
            className="absolute inset-0"
            skin={cmpSkin}
            name={character.name}
            insets={paneInsets(true)}
            command={command}
            backdrop={<BD2Backdrop />}
            backgroundPicker={null}
            tapPlan={bd2TapPlan}
            speed={speed}
          />
          <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1.5" style={{ top: isDesktop ? 52 : 8 }}>
            <span className="bd2-glass max-w-[80%] truncate px-3 py-1 text-[12px] font-semibold">
              <span className="mr-1.5 text-muted">B</span>
              {cmpSkin.name}
            </span>
            <div className="pointer-events-auto -mx-1 flex max-w-[92%] gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Chọn trang phục B">
              {character.skins
                .filter((s) => s.id !== skin.id)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCmpId(s.id)}
                    aria-pressed={s.id === cmpSkin.id}
                    title={s.name}
                    className={`relative h-9 w-7 shrink-0 overflow-hidden rounded-lg border-2 bg-white/10 outline-none transition focus-visible:ring-2 focus-visible:ring-accent ${
                      s.id === cmpSkin.id ? "border-accent" : "border-transparent opacity-75 hover:opacity-100"
                    }`}
                  >
                    <Image src={s.thumb} alt={s.name} fill sizes="28px" className="object-cover object-top" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Lớp giao diện: không chặn chuột, chỉ các phần tử tương tác mới nhận sự kiện. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-4 top-3 flex max-w-[min(34rem,calc(100%-8rem))] flex-col gap-3 sm:left-6 sm:top-4">
          <nav aria-label="Chuyển nhân vật" className="pointer-events-auto flex flex-wrap items-center gap-2">
            <Link href="/bd2" className={chip}>
              ◂ Characters
            </Link>
            {prev && (
              <Link href={`/bd2/characters/${prev.slug}`} title="Nhân vật trước (←)" className={chip}>
                ◂ <span className="hidden sm:inline">{prev.name}</span>
              </Link>
            )}
            {next && (
              <Link href={`/bd2/characters/${next.slug}`} title="Nhân vật sau (→)" className={chip}>
                <span className="hidden sm:inline">{next.name}</span> ▸
              </Link>
            )}
          </nav>

          {/* Toàn màn hình: giấu bảng tên để nhân vật rộng chỗ; nút chuyển nhân vật và dock vẫn dùng được. */}
          {!isFullscreen && !compare && (
            <div className="bd2-glass animate-fade-up w-fit max-w-full px-4 py-3">
              {character.stars ? <Stars value={character.stars} max={character.stars} size={14} /> : null}
              <h1 className="mt-1 font-display text-3xl font-bold uppercase leading-none tracking-tight text-[#fff4d6] [text-shadow:0_0_18px_rgba(255,160,210,0.45)] sm:text-5xl">{character.name}</h1>
              <p className="mt-1.5 text-sm font-medium text-muted">{skin.name}</p>
            </div>
          )}
        </div>

        <div className="pointer-events-auto absolute right-4 top-3 sm:right-6 sm:top-4">
          <button
            type="button"
            aria-expanded={infoOpen}
            aria-controls="bd2-info-drawer"
            onClick={() => setInfoOpen((v) => !v)}
            title="Hồ sơ và hướng dẫn (phím I)"
            data-active={infoOpen}
            className={`${chip} flex items-center gap-2 !py-2`}
          >
            Info <span aria-hidden>{infoOpen ? "✕" : "▸"}</span>
          </button>
        </div>

        {/* Ngăn INFO: cột bên phải trên desktop, bảng trượt từ dưới lên trên mobile. */}
        <div
          id="bd2-info-drawer"
          aria-hidden={!infoOpen}
          inert={!infoOpen}
          className={`absolute z-20 transition duration-300 ease-out ${
            infoOpen ? "translate-x-0 translate-y-0 opacity-100" : "translate-y-6 opacity-0 lg:translate-x-8 lg:translate-y-0"
          } inset-x-3 lg:inset-x-auto lg:right-6 lg:top-16`}
          style={{
            bottom: isDesktop ? 16 : dockH + 12,
            width: isDesktop ? DRAWER_WIDTH : undefined,
            maxHeight: isDesktop ? undefined : "58%",
            pointerEvents: infoOpen ? "auto" : "none",
          }}
        >
          <div className="bd2-glass flex h-full min-h-0 flex-col gap-4 p-5">
            <div role="tablist" className="flex shrink-0 gap-1.5">
              {(["info", "layers"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={drawerTab === t}
                  data-active={drawerTab === t}
                  onClick={() => setDrawerTab(t)}
                  className="bd2-chip flex-1 px-3 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t === "info" ? "Hồ sơ" : "Layers"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {drawerTab === "info" ? (
                <Drawer character={character} activeSkin={skin.id} onSelect={onSelect} />
              ) : (
                <BD2Layers slots={slots} hidden={hidden} onChange={(names) => setHidden({ viewKey, names })} />
              )}
            </div>
          </div>
        </div>

        <div
          ref={dockRef}
          className={`pointer-events-auto absolute inset-x-3 bottom-3 lg:inset-x-auto lg:bottom-4 ${
            compare ? "lg:left-1/2 lg:-translate-x-1/2" : "lg:left-6"
          }`}
          style={{ width: isDesktop ? (compare ? 640 : DOCK_WIDTH) : undefined }}
        >
          <div
            className={`bd2-glass flex max-h-[46dvh] flex-col gap-2 overflow-y-auto px-3 py-2.5 lg:max-h-[calc(100dvh-9rem)] lg:gap-3 lg:px-3.5 lg:py-3 ${
              compare ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5 lg:gap-y-2" : ""
            }`}
          >
            {!compare && (skin.cutscene || skin.dating) && (
              <section aria-label="Chế độ xem">
                <div role="tablist" className="flex gap-1.5">
                  {(["character", "ultimate", "dating"] as const).map((cat) => {
                    const enabled = cat === "character" || (cat === "ultimate" ? !!skin.cutscene : !!skin.dating);
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={category === cat}
                        disabled={!enabled}
                        onClick={() => setCategory(cat)}
                        data-active={category === cat}
                        title={enabled ? undefined : "Trang phục này không có"}
                        className="bd2-chip min-w-0 flex-1 truncate px-2 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {CATEGORY_LABEL[cat]}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {character.skins.length > 1 && (
              <section aria-label="Trang phục">
                <div className="flex items-center justify-between gap-2">
                  <DockLabel>{compare ? "Trang phục A" : "Trang phục"}</DockLabel>
                  {canCompare && (
                    <button
                      type="button"
                      aria-pressed={compare}
                      onClick={() => setCompareOn((v) => !v)}
                      title="So sánh hai trang phục cạnh nhau (phím S)"
                      className="bd2-chip px-2.5 py-0.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      ⇄ So sánh
                    </button>
                  )}
                </div>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5 pt-1">
                  {character.skins.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect(s.id)}
                      aria-pressed={s.id === skin.id}
                      title={s.name}
                      className={`relative shrink-0 overflow-hidden rounded-xl border-2 bg-white/10 outline-none transition focus-visible:ring-2 focus-visible:ring-accent ${
                        compare ? "h-[44px] w-[34px]" : "h-[56px] w-[42px] lg:h-[68px] lg:w-[52px]"
                      } ${
                        s.id === skin.id ? "border-accent" : "border-transparent opacity-75 hover:opacity-100"
                      }`}
                    >
                      <Image src={s.thumb} alt={s.name} fill sizes="52px" className="object-cover object-top" />
                      {s.cutscene && (
                        <span
                          aria-hidden
                          title="Có Ultimate"
                          className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[8px] leading-none text-white"
                        >
                          ▶
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {category === "ultimate" && (
              <section aria-label="Animation Ultimate">
                <DockLabel>Animation</DockLabel>
                <div className="mt-1.5 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pb-1">
                  {active && (
                    <button
                      type="button"
                      onClick={() => playAll(active.list, active.durations)}
                      data-active={!!seqActive && seqActive.label === (defaultSequence?.name ?? "")}
                      title="Phát toàn bộ các pha liên tiếp, rồi giữ đoạn lặp cuối"
                      className={`${itemChip} font-semibold`}
                    >
                      ▶ Phát toàn bộ
                    </button>
                  )}
                  {active &&
                    otherSequences.map((q) => (
                      <button
                        key={q.name}
                        type="button"
                        onClick={() => playSequence(q, active.list, active.durations)}
                        data-active={seqActive?.label === q.name}
                        title="Chuỗi phát chỉnh tay"
                        className={itemChip}
                      >
                        ▶ {q.name}
                      </button>
                    ))}
                  {active ? (
                    ultimateNames.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => playUltimate(n)}
                        data-active={!seqActive && (pick?.name ?? active.current) === n}
                        className={itemChip}
                      >
                        {n}
                      </button>
                    ))
                  ) : (
                    <span className="animate-blink text-xs text-muted">Đang tải…</span>
                  )}
                </div>
                {skin.cutscene && skin.cutscene.backgrounds.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={plateOn}
                    onClick={() => setPlateOn((v) => !v)}
                    title="Dùng ảnh nền của cutscene (đổi theo pha của animation đang chọn)"
                    className="bd2-chip mt-2 px-2.5 py-0.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Nền cutscene
                  </button>
                )}
                <CutsceneAutoSwitch />
              </section>
            )}

            {category === "dating" && (
              <section aria-label="Fated Guest" className="flex flex-col gap-2">
                {!active && <span className="animate-blink text-xs text-muted">Đang tải… (tranh nặng, chờ vài giây)</span>}
                {spineSkins.length > 1 && (
                  <div>
                    <DockLabel>Skin</DockLabel>
                    <div className="mt-1.5 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pb-1">
                      {["auto", ...[...spineSkins].sort(naturalSort)].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPickPart({ skinName: n })}
                          data-active={spineSkin === n}
                          title={n === "auto" ? "Tự chọn skin phù hợp với cảnh đang xem" : undefined}
                          className={itemChip}
                        >
                          {n === "auto" ? "Tự động" : n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {dating && dating.scenes.length > 0 && (
                  <div>
                    <DockLabel>Cảnh</DockLabel>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {dating.scenes.map((sc) => (
                        <button
                          key={sc.n}
                          type="button"
                          onClick={() => (sc.idle ? playDating(sc.idle, sc.idle, sc.n) : playDating(sc.mixes[0], sc.mixes[0], sc.n))}
                          data-active={sceneN === sc.n}
                          className={itemChip}
                        >
                          {sc.n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {scene && scene.mixes.length > 0 && (
                  <div>
                    <DockLabel>Chạm / hoạt cảnh</DockLabel>
                    <div className="mt-1.5 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pb-1">
                      {scene.mixes.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => playDating(m, scene.idle || m, scene.n)}
                          data-active={pick?.name === m}
                          title={m}
                          className={`${itemChip} !px-2.5 !text-[12px] tabular-nums`}
                        >
                          {m.replace(/^mix\d+_/, "")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {dating && dating.others.length > 0 && (
                  <div>
                    <DockLabel>Khác</DockLabel>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {dating.others.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => (isMotion(n) ? playMotion(n) : playDating(n, n, null))}
                          data-active={pick?.name === n}
                          title={n}
                          className={itemChip}
                        >
                          {motionLabel(n)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {category === "character" && (
              <>
              <section aria-label="Chuyển động">
                <DockLabel>Chuyển động</DockLabel>
                <div className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
                  {active ? (
                    body.map((b) => (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => playBody(b.name)}
                        data-active={active.current === b.name}
                        className="bd2-chip shrink-0 px-3 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {b.label}
                      </button>
                    ))
                  ) : (
                    <span className="animate-blink text-xs text-muted">Đang tải…</span>
                  )}
                </div>
              </section>

              {!compare && faces.length > 0 && (
                <section aria-label="Biểu cảm">
                  <div className="flex items-center justify-between gap-2">
                    <DockLabel>Biểu cảm</DockLabel>
                    {talkFaces.size > 0 && (
                      <button
                        type="button"
                        aria-pressed={overlay.talk}
                        onClick={() => applyOverlay(overlay.face, !overlay.talk)}
                        title="Nhép miệng theo biểu cảm đang chọn"
                        className="bd2-chip px-2.5 py-0.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        ♪ Nhép miệng
                      </button>
                    )}
                  </div>
                  <div className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
                    <button
                      type="button"
                      aria-label="Bỏ biểu cảm"
                      title="Về nét mặt mặc định"
                      onClick={() => applyOverlay(null, false)}
                      data-active={overlay.face === null && !overlay.talk}
                      className="bd2-chip h-8 w-8 shrink-0 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      ✕
                    </button>
                    {faces.map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`Biểu cảm ${n}`}
                        title={`Biểu cảm ${n}`}
                        onClick={() => applyOverlay(n, overlay.talk)}
                        data-active={overlay.face === n}
                        className="bd2-chip h-8 w-8 shrink-0 text-[13px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              </>
            )}

            <section aria-label="Phát" className="flex items-center gap-3 lg:col-span-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-[12px] font-medium text-muted">
                <span className="shrink-0">Tốc độ</span>
                <input
                  type="range"
                  min={0.1}
                  max={2}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  onDoubleClick={() => setSpeed(1)}
                  title="Nhấp đúp để về 1x"
                  className="min-w-0 flex-1 accent-[var(--accent)]"
                />
                <span className="w-11 shrink-0 text-right tabular-nums text-foreground">{speed.toFixed(2)}x</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setDrawerTab("layers");
                  setInfoOpen(true);
                }}
                title="Bật/tắt từng lớp của mô hình"
                className="bd2-chip shrink-0 px-3 py-1 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Layers
              </button>
            </section>
          </div>
        </div>
      </div>

    </div>
  );
}

function DockLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{children}</h2>;
}

/** Nội dung ngăn INFO: hồ sơ ngắn, danh sách trang phục và hướng dẫn thao tác. */
function Drawer({ character, activeSkin, onSelect }: { character: Character; activeSkin: string; onSelect: (id: string) => void }) {
  const hints: [string, string][] = [
    ["Nhấp", "Chạm vào nhân vật để họ làm một cử động và nói (khi đứng yên)"],
    ["Kéo", "Di chuyển góc nhìn (hai ngón để zoom)"],
    ["Cuộn", "Zoom tại vị trí con trỏ"],
    ["← →", "Chuyển nhân vật"],
    ["C", "Đổi trang phục"],
    ["F", "Toàn màn hình"],
    ["B", "Đổi nền"],
    ["S", "So sánh hai trang phục (bật/tắt)"],
    ["I", "Mở/đóng bảng này"],
  ];
  return (
    <div className="space-y-5">
      <section>
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#fff4d6]">{character.name}</h2>
        <div className="mt-1 flex items-center gap-2">
          {character.stars ? <Stars value={character.stars} max={character.stars} size={14} /> : null}
          <span className="text-xs text-muted">{character.skins.length} trang phục</span>
        </div>
      </section>

      <hr className="border-line" />

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Trang phục</h3>
        <ul className="space-y-1.5">
          {character.skins.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                data-active={s.id === activeSkin}
                className="bd2-chip flex w-full items-center justify-between gap-3 !rounded-xl px-3 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 text-[11px] font-medium opacity-70">{formatDate(s.released) ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <hr className="border-line" />

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Điều khiển</h3>
        <ul className="space-y-2 text-[13px] text-muted">
          {hints.map(([key, text]) => (
            <li key={key} className="flex items-start gap-3">
              <kbd className="mt-px min-w-9 shrink-0 rounded-md border border-line bg-white/10 px-1.5 py-0.5 text-center text-[11px] font-semibold text-foreground">
                {key}
              </kbd>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Đọc ?skin= từ URL; đổi chỉ cập nhật URL (replace), không thêm lịch sử và không hỏi lại server. */
function UrlShowcase(props: { character: Character; prev: Neighbor; next: Neighbor }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultId = bd2DefaultSkin(props.character).id;

  const select = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === defaultId) params.delete("skin");
    else params.set("skin", id);
    const qs = params.toString();
    // Phải truyền null (đúng như docs): truyền lại history.state của router sẽ khiến Next bỏ qua việc đồng bộ.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  return <Showcase {...props} skinId={searchParams.get("skin")} onSelect={select} autoplay />;
}

export function BD2Showcase(props: { character: Character; prev: Neighbor; next: Neighbor }) {
  return (
    // Fallback hiển thị trang phục mặc định trong lúc chờ đọc URL, nên không bị nhảy layout.
    <Suspense fallback={<Showcase {...props} onSelect={() => {}} />}>
      <UrlShowcase {...props} />
    </Suspense>
  );
}
