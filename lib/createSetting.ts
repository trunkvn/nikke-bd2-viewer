/**
 * Cài đặt người dùng lưu ở localStorage, đọc bằng useSyncExternalStore
 * (snapshot phía server là giá trị mặc định nên không lệch hydration).
 * Nếu localStorage bị chặn hoặc đầy (ví dụ ảnh nền lớn), giá trị vẫn được giữ trong bộ nhớ của phiên hiện tại.
 */
export function createSetting(key: string, fallback: string) {
  const listeners = new Set<() => void>();
  let memory: string | null = null;
  return {
    fallback,
    subscribe(cb: () => void) {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    get(): string {
      try {
        return localStorage.getItem(key) ?? memory ?? fallback;
      } catch {
        return memory ?? fallback;
      }
    },
    /** @returns false nếu không lưu bền được (chỉ còn giữ trong phiên này). */
    set(value: string): boolean {
      memory = value;
      let persisted = true;
      try {
        localStorage.setItem(key, value);
      } catch {
        persisted = false;
      }
      listeners.forEach((l) => l());
      return persisted;
    },
    clear() {
      memory = null;
      try {
        localStorage.removeItem(key);
      } catch {
        // bỏ qua
      }
      listeners.forEach((l) => l());
    },
  };
}
