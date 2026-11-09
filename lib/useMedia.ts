import { useSyncExternalStore } from "react";

/** Theo dõi một media query; `serverValue` là giá trị dùng khi render phía server và lần hydrate đầu (tránh lệch). */
export function useMedia(query: string, serverValue: boolean) {
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
