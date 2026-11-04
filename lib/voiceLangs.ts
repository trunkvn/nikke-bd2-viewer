const INFO: Record<string, { label: string; name: string }> = {
  ja: { label: "JP", name: "Tiếng Nhật" },
  en: { label: "EN", name: "Tiếng Anh" },
  ko: { label: "KR", name: "Tiếng Hàn" },
  zh: { label: "CN", name: "Tiếng Trung" },
};

export const langLabel = (code: string) => INFO[code]?.label ?? code.toUpperCase();
export const langName = (code: string) => INFO[code]?.name ?? code.toUpperCase();
