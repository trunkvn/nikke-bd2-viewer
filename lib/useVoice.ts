"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Voice, VoiceLang } from "@/data/types";
import { voiceEnabledSetting, voiceLangSetting } from "./voiceSettings";

export type VoiceTrigger = "enter" | "touch";

export type VoiceUi = {
  /** Nhân vật có file voice nào không (để ẩn/hiện nút loa). */
  available: boolean;
  enabled: boolean;
  toggle: () => void;
  /** Ngôn ngữ đang dùng và các ngôn ngữ có sẵn (chỉ hiện nút chuyển khi có từ 2). */
  lang: VoiceLang | null;
  langs: VoiceLang[];
  setLang: (lang: VoiceLang) => void;
  speaking: boolean;
  /** Phụ đề của câu đang nói (nếu có captions.json). */
  caption: string | null;
  /** Trình duyệt chặn tự phát; sẽ phát ngay khi người dùng chạm/nhấn phím đầu tiên. */
  blocked: boolean;
  play: (trigger: VoiceTrigger, lang?: VoiceLang) => void;
};

type Status = { speaking: boolean; caption: string | null; blocked: boolean };
const IDLE: Status = { speaking: false, caption: null, blocked: false };

/**
 * Phát giọng nói của nhân vật:
 *  - "enter": tự phát khi trang nhân vật hiện ra (vào lần đầu, đổi nhân vật, quay lại trang đã ẩn).
 *  - "touch": gọi `play("touch")` khi người dùng nhấp vào nhân vật.
 * `key` là định danh nhân vật; đổi key thì dừng câu cũ và phát câu "enter" mới.
 */
export function useVoice(voice: Voice | undefined, key: string): VoiceUi {
  const enabled = useSyncExternalStore(
    voiceEnabledSetting.subscribe,
    () => voiceEnabledSetting.get() !== "off",
    () => true,
  );
  const preferredLang = useSyncExternalStore(
    voiceLangSetting.subscribe,
    voiceLangSetting.get,
    () => voiceLangSetting.fallback,
  );
  const langs = Object.keys(voice ?? {}).sort();
  const lang = (voice?.[preferredLang] ? preferredLang : langs[0]) ?? null;
  const [status, setStatus] = useState<Status>(IDLE);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSrc = useRef<Partial<Record<VoiceTrigger, string>>>({});
  const pending = useRef<VoiceTrigger | null>(null);
  const available = langs.length > 0;

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
    }
    setStatus((s) => (s.speaking || s.caption ? { ...s, speaking: false, caption: null } : s));
  }, []);

  const play = useCallback(
    (trigger: VoiceTrigger, langOverride?: VoiceLang) => {
      const lines = voice?.[langOverride ?? lang ?? ""]?.[trigger];
      if (!enabled || !lines?.length) return;

      // Chọn ngẫu nhiên, tránh lặp lại đúng câu vừa nói.
      const pool = lines.length > 1 ? lines.filter((l) => l.src !== lastSrc.current[trigger]) : lines;
      const line = pool[Math.floor(Math.random() * pool.length)];
      lastSrc.current[trigger] = line.src;

      const audio = (audioRef.current ??= new Audio());
      audio.pause();
      const finish = () => setStatus((s) => ({ ...s, speaking: false, caption: null }));
      audio.onended = finish;
      audio.onerror = () => {
        console.warn(`[voice] không phát được: ${line.src}`);
        finish();
      };
      audio.src = line.src;
      audio.volume = 0.9;
      setStatus((s) => ({ ...s, speaking: true, caption: line.text ?? null }));

      audio.play().then(
        () => {
          pending.current = null;
          setStatus((s) => (s.blocked ? { ...s, blocked: false } : s));
        },
        (err: unknown) => {
          const blocked = err instanceof DOMException && err.name === "NotAllowedError";
          if (blocked) pending.current = trigger;
          setStatus((s) => ({ speaking: false, caption: null, blocked: blocked || s.blocked }));
        },
      );
    },
    [voice, enabled, lang],
  );

  // Luôn gọi bản play mới nhất từ các effect mà không phải đưa nó vào deps.
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });

  // Vào xem / đổi nhân vật / hiện lại trang: nói câu "enter". Rời đi thì dừng.
  useEffect(() => {
    playRef.current("enter");
    return stop;
  }, [key, stop]);

  // Tắt từ nơi khác (ví dụ tab khác qua localStorage) thì dừng tiếng ngay; trạng thái hiển thị được che bên dưới.
  useEffect(() => {
    if (!enabled) audioRef.current?.pause();
  }, [enabled]);

  // Bị chặn autoplay (ví dụ tải lại trang): phát câu đang chờ ngay cử chỉ đầu tiên.
  useEffect(() => {
    if (!status.blocked) return;
    const retry = () => {
      const t = pending.current;
      pending.current = null;
      if (t) playRef.current(t);
    };
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [status.blocked]);

  const toggle = useCallback(() => {
    const next = voiceEnabledSetting.get() === "off"; // đang tắt → bật
    if (!next) stop();
    voiceEnabledSetting.set(next ? "on" : "off");
  }, [stop]);

  // Đổi ngôn ngữ: lưu lại và nói luôn một câu chào bằng ngôn ngữ mới để người dùng nghe thử.
  const setLang = useCallback(
    (next: VoiceLang) => {
      voiceLangSetting.set(next);
      // Brown Dust 2 chỉ có câu "touch" (không có "enter"): nghe thử bằng câu đó.
      playRef.current(voice?.[next]?.enter?.length ? "enter" : "touch", next);
    },
    [voice],
  );

  return {
    available,
    enabled,
    toggle,
    lang,
    langs,
    setLang,
    speaking: enabled && status.speaking,
    caption: enabled ? status.caption : null,
    blocked: status.blocked,
    play,
  };
}
