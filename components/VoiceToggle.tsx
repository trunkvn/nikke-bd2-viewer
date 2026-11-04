"use client";

import { langLabel, langName } from "@/lib/voiceLangs";
import { ToolButton } from "./ViewerStage";

/** Nút bật/tắt giọng nói trong thanh công cụ của khung viewer. */
export function VoiceToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <ToolButton label={enabled ? "Tắt giọng nói" : "Bật giọng nói"} onClick={onToggle} pressed={enabled}>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" stroke="none" />
        {enabled ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="m16 9 5 6m0-6-5 6" />
        )}
      </svg>
    </ToolButton>
  );
}

/** Chuyển vòng giữa các ngôn ngữ giọng nói có sẵn (chỉ hiển thị khi có từ 2 ngôn ngữ). */
export function VoiceLangButton({
  lang,
  langs,
  onChange,
}: {
  lang: string;
  langs: string[];
  onChange: (lang: string) => void;
}) {
  const next = langs[(langs.indexOf(lang) + 1) % langs.length];
  return (
    <ToolButton label={`Giọng nói: ${langName(lang)} (bấm để đổi sang ${langName(next)})`} onClick={() => onChange(next)}>
      <span className="font-mono text-[11px] font-bold tracking-wider">{langLabel(lang)}</span>
    </ToolButton>
  );
}
