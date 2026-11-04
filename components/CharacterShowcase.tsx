"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { POSES, type Character, type Pose } from "@/data/types";
import { isIdleAnimation, selectableAnimations } from "@/lib/animations";
import { cycleBackground } from "@/lib/viewerBg";
import { useVoice } from "@/lib/useVoice";
import { AnimationPicker } from "./AnimationPicker";
import { CharacterViewer } from "./CharacterViewer";
import { FullscreenButton } from "./FullscreenButton";
import { POSE_LABEL, PoseSwitcher } from "./PoseSwitcher";
import { SkinSwitcher } from "./SkinSwitcher";
import type { PlayCommand } from "./SpineRenderer";
import type { Insets } from "./ViewerStage";
import { Panel } from "./ui/Panel";

/** `viewKey` định danh skeleton đang xem (skin + tư thế): đổi tư thế thì danh sách animation cũ mất hiệu lực. */
type AnimState = { viewKey: string; list: string[]; current: string | null };

type ShowcaseSlots = {
  character: Character;
  /** Thông tin định danh (rarity, tên, tag...) hiện ở góc trên-trái, luôn thấy. */
  identity: ReactNode;
  /** Liên kết quay lại + chuyển nhân vật, ở mép trên. */
  nav: ReactNode;
  /** Hồ sơ, thông số, hướng dẫn: nằm trong ngăn INFO. */
  drawer: ReactNode;
};

const DESKTOP_QUERY = "(min-width: 1024px)";
const WIDE_QUERY = "(min-width: 1280px)";
const DRAWER_WIDTH = 360;
const DOCK_WIDTH = 400;

function useMedia(query: string, serverValue: boolean) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}


function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

/** Trạng thái toàn màn hình của trình duyệt + khả năng hỗ trợ (iPhone Safari không hỗ trợ cho phần tử thường). */
function useFullscreen() {
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement != null,
    () => false,
  );
  const supported = useSyncExternalStore(
    () => () => {},
    () => document.fullscreenEnabled === true,
    () => false,
  );
  return { isFullscreen, supported };
}

/**
 * Màn hình xem nhân vật full-bleed: viewer lấp đầy khung, mọi điều khiển nổi lên trên.
 *  - Trên-trái: định danh. Trên-phải: chuyển nhân vật + nút INFO.
 *  - Dock: skin + animation + nút Lặp. Desktop: xếp dọc ở góc dưới-trái (dải đáy giữa dành cho nhân vật);
 *    mobile: dải ngang ở đáy. Ngăn INFO bên phải (desktop) / bảng trượt từ dưới (mobile).
 * Nhân vật luôn căn giữa trong phần diện tích không bị che (insets).
 * Toàn màn hình (nút/phím F): giao diện tự ẩn sau vài giây không thao tác và nhân vật nở ra lấp đầy màn hình.
 */
function Showcase({
  character,
  identity,
  nav,
  drawer,
  skinId,
  onSelect,
  poseParam,
  onSelectPose,
}: ShowcaseSlots & {
  skinId?: string | null;
  onSelect: (id: string) => void;
  /** Tư thế yêu cầu từ URL; bị bỏ qua nếu skin hiện tại không có tư thế đó. */
  poseParam?: string | null;
  onSelectPose: (pose: Pose) => void;
}) {
  const skin =
    character.skins.find((s) => s.id === skinId) ?? character.skins[0];

  // Tư thế: "stand" luôn có; "aim"/"cover" là skeleton Spine riêng, không phải skin nào cũng có.
  const availablePoses = POSES.filter((p) => p === "stand" || skin.poses?.[p]);
  const pose: Pose = availablePoses.find((p) => p === poseParam) ?? "stand";
  const render = pose === "stand" ? skin.render : skin.poses![pose as "aim" | "cover"]!;
  const viewSkin = pose === "stand" ? skin : { ...skin, render };
  const viewKey = render.kind === "spine" ? render.skel : skin.id;
  const isDesktop = useMedia(DESKTOP_QUERY, true);
  const isWide = useMedia(WIDE_QUERY, true);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isFullscreen: apiFullscreen, supported: apiSupported } = useFullscreen();
  // Trình duyệt không có Fullscreen API cho phần tử thường (iPhone Safari): phóng khung viewer ra phủ kín cửa sổ
  // (che luôn header). Không ẩn được thanh địa chỉ của trình duyệt, nhưng nhân vật và điều khiển thì giống hệt.
  const [immersive, setImmersive] = useState(false);
  const isFullscreen = apiFullscreen || immersive;

  // Danh sách animation thuộc về từng skin; đổi skin thì trạng thái cũ tự mất hiệu lực.
  const [anim, setAnim] = useState<AnimState | null>(null);
  const [command, setCommand] = useState<PlayCommand | null>(null);
  const [loop, setLoop] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const active = anim?.viewKey === viewKey ? anim : null;
  const selectable = selectableAnimations(active?.list ?? []);

  // Giọng nói gắn với nhân vật (không phải skin): nói khi vào/đổi nhân vật và khi nhấp vào.
  const voice = useVoice(character.voice, character.id);
  // Đo chiều cao dock để chừa chỗ cho nhân vật và đặt phụ đề phía trên nó.
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(0);
  const hasDock = character.skins.length > 1 || skin.render.kind === "spine";
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setDockH(Math.round(entry.target.getBoundingClientRect().height)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasDock]);

  const play = (name: string, loopNow = loop) =>
    setCommand((c) => ({ name, nonce: (c?.nonce ?? 0) + 1, loop: loopNow }));

  const toggleLoop = () => {
    const next = !loop;
    setLoop(next);
    // Đang phát một animation không phải idle thì phát lại ngay theo chế độ mới.
    if (active?.current && !isIdleAnimation(active.current))
      play(active.current, next);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (apiSupported) {
      void rootRef.current?.requestFullscreen().catch(() => setImmersive(true));
    } else {
      setImmersive((v) => !v);
    }
  };

  // Esc thoát chế độ phủ kín giả lập (toàn màn hình thật đã được trình duyệt tự thoát bằng Esc).
  useEffect(() => {
    if (!immersive) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setImmersive(false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [immersive]);

  // Phím tắt: 1–9 chọn animation, I mở/đóng INFO, L bật/tắt lặp, F toàn màn hình.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT")
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) {
        const name = selectable[Number(e.key) - 1];
        if (name)
          setCommand((c) => ({ name, nonce: (c?.nonce ?? 0) + 1, loop }));
      } else if (e.key === "i" || e.key === "I") {
        setInfoOpen((v) => !v);
      } else if (
        (e.key === "l" || e.key === "L") &&
        skin.render.kind === "spine"
      ) {
        setLoop((v) => !v);
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "b" || e.key === "B") {
        cycleBackground();
      } else if ((e.key === "p" || e.key === "P") && availablePoses.length > 1) {
        onSelectPose(availablePoses[(availablePoses.indexOf(pose) + 1) % availablePoses.length]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectable, loop, skin.render.kind, apiSupported, availablePoses, pose, onSelectPose]);

  // Giao diện ẩn khi toàn màn hình + rảnh tay (không ẩn khi đang mở INFO): nhân vật chiếm trọn màn hình.
  const hideUi = isFullscreen && !infoOpen;

  const drawerOnSide = isDesktop && infoOpen;
  // Desktop: dock nằm ở góc dưới-trái nên không cần chừa đáy. Chỉ chừa chiều ngang bên trái khi màn hình
  // hẹp hoặc khi ngăn INFO đẩy nhân vật về phía dock, để chân nhân vật không chui sau dock.
  const leftInset =
    isDesktop && hasDock && (drawerOnSide || !isWide) ? DOCK_WIDTH + 16 : 0;
  const insets: Insets = hideUi
    ? { top: 12, left: 0, right: 0, bottom: 12 }
    : isDesktop
      ? {
          top: 8,
          left: leftInset,
          right: drawerOnSide ? DRAWER_WIDTH + 24 : 0,
          bottom: 12,
        }
      : { top: 84, left: 0, right: 0, bottom: hasDock ? dockH + 22 : 14 };

  return (
    <div
      ref={rootRef}
      className={`w-full overflow-hidden bg-bg ${
        immersive
          ? "fixed inset-0 z-50 h-dvh"
          : apiFullscreen
            ? "relative h-dvh"
            : "relative h-[calc(100dvh-3.5rem)] min-h-[560px]"
      }`}
    >
      <CharacterViewer
        className="absolute inset-0"
        skin={viewSkin}
        name={character.name}
        insets={insets}
        captionBottom={hideUi || isDesktop ? 24 : hasDock ? dockH + 28 : 20}
        command={command}
        voice={voice}
        controlsHidden={hideUi}
        toolbarExtra={
          <FullscreenButton active={isFullscreen} onToggle={toggleFullscreen} />
        }
        onAnimations={(list) => setAnim({ viewKey, list, current: null })}
        onPlaying={(name) =>
          setAnim((a) => (a && a.viewKey === viewKey ? { ...a, current: name } : a))
        }
      />

      {/* Lớp giao diện: không chặn chuột, chỉ các phần tử tương tác mới nhận sự kiện. */}
      <div
        inert={hideUi}
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 ${
          hideUi ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="absolute left-4 top-3 flex max-w-[min(30rem,calc(100%-9rem))] flex-col gap-3 sm:left-6 sm:top-4">
          <div className="pointer-events-auto w-fit">{nav}</div>
          <div className="pointer-events-auto w-fit">{identity}</div>
          <div className="pointer-events-none flex flex-col items-start gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]">
            {character.skins.length > 1 && (
              <span className="clip-chamfer-sm hidden bg-black/45 px-2.5 py-1 text-white/70 backdrop-blur sm:inline-block">
                <span className="text-white/40">Skin · </span>
                {skin.name}
                {pose !== "stand" && (
                  <>
                    <span className="text-white/40"> · </span>
                    {POSE_LABEL[pose]}
                  </>
                )}
              </span>
            )}
            {skin.render.kind === "spine" && (
              <span className="hidden text-white/30 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)] sm:inline">
                Nhấp vào nhân vật để tương tác
              </span>
            )}
          </div>
        </div>

        <div className="pointer-events-auto absolute right-4 top-3 sm:right-6 sm:top-4">
          <button
            type="button"
            aria-expanded={infoOpen}
            aria-controls="info-drawer"
            onClick={() => setInfoOpen((v) => !v)}
            title="Hồ sơ & thông số (phím I)"
            className={`clip-chamfer-sm flex items-center gap-2 px-4 py-2 font-display text-sm font-medium uppercase tracking-wider outline-none backdrop-blur transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              infoOpen
                ? "bg-accent text-black"
                : "bg-black/50 text-white/80 hover:bg-white/15 hover:text-white"
            }`}
          >
            Info <span aria-hidden>{infoOpen ? "✕" : "▸"}</span>
          </button>
        </div>

        {/* Ngăn INFO: cột bên phải trên desktop, bảng trượt từ dưới lên trên mobile. */}
        <div
          id="info-drawer"
          aria-hidden={!infoOpen}
          inert={!infoOpen}
          className={`absolute z-20 transition duration-300 ease-out ${
            infoOpen
              ? "translate-x-0 translate-y-0 opacity-100"
              : "translate-y-6 opacity-0 lg:translate-x-8 lg:translate-y-0"
          } inset-x-3 lg:inset-x-auto lg:right-6 lg:top-16`}
          style={{
            bottom: isDesktop ? 16 : hasDock ? dockH + 12 : 12,
            width: isDesktop ? DRAWER_WIDTH : undefined,
            maxHeight: isDesktop ? undefined : "58%",
            pointerEvents: infoOpen ? "auto" : "none",
          }}
        >
          <Panel
            glass
            cut="md"
            className="h-full"
            innerClassName="h-full overflow-y-auto p-5"
          >
            <div className="space-y-6">{drawer}</div>
          </Panel>
        </div>

        {hasDock && (
          <div
            ref={dockRef}
            className="pointer-events-auto absolute inset-x-3 bottom-3 lg:inset-x-auto lg:bottom-4 lg:left-6"
            style={{ width: isDesktop ? DOCK_WIDTH : undefined }}
          >
            <Panel glass cut="md" innerClassName="flex flex-col gap-2.5 px-3 py-2.5">
              {[
                availablePoses.length > 1 && (
                  <section
                    key="pose"
                    aria-label="Tư thế"
                    className="flex min-w-0 items-center gap-2.5 lg:flex-col lg:items-stretch lg:gap-2"
                  >
                    <DockLabel>Tư thế</DockLabel>
                    <PoseSwitcher available={availablePoses} active={pose} onSelect={onSelectPose} />
                  </section>
                ),
                character.skins.length > 1 && (
                  <section
                    key="skin"
                    aria-label="Skin"
                    className="flex min-w-0 items-center gap-2.5 lg:flex-col lg:items-stretch lg:gap-2"
                  >
                    <DockLabel>Skin</DockLabel>
                    <SkinSwitcher skins={character.skins} activeId={skin.id} onSelect={onSelect} />
                  </section>
                ),
                render.kind === "spine" && (
                  // Mobile: một hàng [nhãn | chip cuộn ngang | Lặp]. Desktop: lưới 2 hàng, nhãn + nút Lặp ở trên, chip tự xuống dòng bên dưới.
                  <section
                    key="anim"
                    aria-label="Animation"
                    className="flex min-w-0 items-center gap-2.5 lg:grid lg:grid-cols-[1fr_auto] lg:gap-x-2 lg:gap-y-2"
                  >
                    <div className="lg:col-start-1 lg:row-start-1">
                      <DockLabel>Animation</DockLabel>
                    </div>
                    <div className="min-w-0 flex-1 lg:col-span-2 lg:row-start-2">
                      <AnimationPicker
                        animations={active?.list ?? []}
                        current={active?.current ?? null}
                        loading={!active}
                        onSelect={(name) => play(name)}
                      />
                    </div>
                    <button
                      type="button"
                      aria-pressed={loop}
                      onClick={toggleLoop}
                      title="Phát lặp animation đang chọn (phím L)"
                      className={`clip-chamfer-sm flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-display text-[13px] font-medium uppercase tracking-wider outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent lg:col-start-2 lg:row-start-1 lg:py-1 ${
                        loop
                          ? "bg-accent text-black"
                          : "bg-white/[0.07] text-white/65 hover:bg-white/[0.14] hover:text-white"
                      }`}
                    >
                      <span aria-hidden>↻</span> Lặp
                    </button>
                  </section>
                ),
              ]
                .filter(Boolean)
                .flatMap((section, i) =>
                  i === 0 ? [section] : [<div key={`d${i}`} aria-hidden className="hidden h-px bg-white/10 lg:block" />, section],
                )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function DockLabel({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
      <span className="h-3 w-0.5 bg-accent" />
      {children}
    </span>
  );
}

/** Đọc ?skin= và ?pose= từ URL; đổi chỉ cập nhật URL (replace), không thêm lịch sử. */
function UrlShowcase(props: ShowcaseSlots) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Chỉ để lưu trạng thái xem vào URL (chia sẻ/tải lại được): dùng history.replaceState (Next đồng bộ với
  // useSearchParams) thay vì router.replace, vì router.replace còn đi hỏi server lấy lại trang, làm đổi
  // skin/tư thế chậm hẳn đi dù trang không dùng các tham số này ở phía server.
  const update = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    // Phải truyền null (đúng như docs): truyền lại history.state của router sẽ khiến Next bỏ qua việc đồng bộ.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  const select = (id: string) =>
    update((params) => {
      if (id === props.character.skins[0].id) params.delete("skin");
      else params.set("skin", id);
    });

  const selectPose = (pose: Pose) =>
    update((params) => {
      if (pose === "stand") params.delete("pose");
      else params.set("pose", pose);
    });

  return (
    <Showcase
      {...props}
      skinId={searchParams.get("skin")}
      onSelect={select}
      poseParam={searchParams.get("pose")}
      onSelectPose={selectPose}
    />
  );
}

export function CharacterShowcase(props: ShowcaseSlots) {
  return (
    // Fallback hiển thị skin mặc định trong lúc chờ đọc URL, nên không bị nhảy layout.
    <Suspense fallback={<Showcase {...props} onSelect={() => {}} onSelectPose={() => {}} />}>
      <UrlShowcase {...props} />
    </Suspense>
  );
}
