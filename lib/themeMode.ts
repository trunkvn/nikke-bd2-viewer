/**
 * Chế độ sáng/tối của trang. Mọi game dùng chung một khoá localStorage nên chọn một lần là áp dụng cho cả bốn trang.
 * Giá trị nằm ở thuộc tính `data-theme` trên <html> ("light" | "dark"); CSS của từng trang đổi token màu theo thuộc tính này.
 * Chưa chọn lần nào thì theo thiết lập sáng/tối của hệ điều hành.
 */
export type ThemeMode = "light" | "dark";

export const THEME_KEY = "theme";

/**
 * Script chạy đồng bộ trong <head>, trước khi trình duyệt vẽ, để trang không nháy sai màu lúc tải.
 * Là chuỗi thuần (không import được vào script nội tuyến); giữ ngắn và tự chịu lỗi (localStorage có thể bị chặn).
 */
export const THEME_INIT_SCRIPT = `(function(){var t;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.setAttribute("data-theme",t)})()`;

export function readTheme(): ThemeMode {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/** Thanh địa chỉ trên điện thoại ăn theo màu nền của trang đang hiển thị. */
export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.body).backgroundColor;
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // localStorage bị chặn: vẫn đổi được trong phiên này, chỉ không nhớ lần sau.
  }
  syncThemeColor();
}

export function subscribeTheme(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY && (e.newValue === "light" || e.newValue === "dark")) {
      document.documentElement.setAttribute("data-theme", e.newValue);
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}
