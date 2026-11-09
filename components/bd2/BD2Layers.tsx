"use client";

import { useState } from "react";
import { naturalSort } from "@/lib/bd2";

/**
 * Bảng bật/tắt từng lớp (slot) của mô hình đang xem. Tiện để xem riêng phần thân, tách vũ khí/hiệu ứng, hay ẩn lớp bị lỗi.
 * `hidden` là danh sách lớp đang ẩn; bấm lớp để đổi, "Hiện tất cả" để trả lại.
 */
export function BD2Layers({ slots, hidden, onChange }: { slots: string[]; hidden: string[]; onChange: (names: string[]) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const sorted = [...new Set(slots)].sort(naturalSort);
  const shown = q ? sorted.filter((n) => n.toLowerCase().includes(q)) : sorted;
  const off = new Set(hidden);
  const toggle = (name: string) => onChange(off.has(name) ? hidden.filter((n) => n !== name) : [...hidden, name]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Lọc lớp…"
          aria-label="Lọc lớp"
          className="min-w-0 flex-1 rounded-xl border border-line bg-white/10 px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={hidden.length === 0}
          className="bd2-chip shrink-0 px-3 py-1.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        >
          Hiện tất cả
        </button>
      </div>
      <p className="text-[11px] text-muted">
        {slots.length === 0 ? "Đang tải…" : `${slots.length - hidden.length}/${slots.length} lớp đang hiện`}
      </p>
      <ul className="-mx-1 min-h-0 flex-1 space-y-px overflow-y-auto px-1">
        {shown.length === 0 && slots.length > 0 && <li className="px-2 py-2 text-sm text-muted">Không có lớp nào khớp.</li>}
        {shown.map((name) => (
          <li key={name}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[13px] hover:bg-white/10">
              <input type="checkbox" checked={!off.has(name)} onChange={() => toggle(name)} className="accent-[var(--accent)]" />
              <span className="truncate" title={name}>
                {name}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
