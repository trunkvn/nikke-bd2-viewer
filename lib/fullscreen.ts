/**
 * Toàn màn hình của CẢ TRANG (không phải riêng khung viewer), để chuyển sang nhân vật khác vẫn giữ nguyên chế độ:
 * điều hướng phía client thay phần tử khung viewer, nếu toàn màn hình gắn vào khung đó thì trình duyệt sẽ tự thoát.
 *
 *  - Có Fullscreen API: dùng `document.documentElement`.
 *  - Không có (iPhone Safari): chế độ "phủ kín" giả lập, chỉ ẩn header và cho khung viewer cao 100dvh.
 * Cả hai đều bật thuộc tính `data-fs` trên <html>; CSS (globals.css) dựa vào nó để ẩn header và nới khung viewer,
 * nên cả skeleton hiện trong lúc chuyển trang cũng không bị nháy header.
 *
 * Trạng thái nằm ở module (không phải trong component) nên không mất khi component dựng lại.
 */
let immersive = false;
const subscribers = new Set<() => void>();

const isReal = () => document.fullscreenElement != null;

function sync() {
  document.documentElement.toggleAttribute("data-fs", immersive || isReal());
  subscribers.forEach((fn) => fn());
}

function onEscape(e: KeyboardEvent) {
  if (e.key === "Escape") setImmersive(false);
}

function setImmersive(on: boolean) {
  if (immersive === on) return;
  immersive = on;
  if (on) window.addEventListener("keydown", onEscape);
  else window.removeEventListener("keydown", onEscape);
  sync();
}

if (typeof document !== "undefined") {
  // Toàn màn hình thật có thể bị thoát từ bên ngoài (Esc, vuốt trên Android...).
  document.addEventListener("fullscreenchange", sync);
}

export function subscribeFullscreen(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export const getFullscreen = () => immersive || isReal();

export function toggleFullscreen() {
  if (isReal()) {
    void document.exitFullscreen();
  } else if (immersive) {
    setImmersive(false);
  } else if (document.fullscreenEnabled === true) {
    // Từ chối (hiếm: không có cử chỉ người dùng, bị chính sách chặn) thì rơi về chế độ phủ kín.
    void document.documentElement.requestFullscreen().catch(() => setImmersive(true));
  } else {
    setImmersive(true);
  }
}
