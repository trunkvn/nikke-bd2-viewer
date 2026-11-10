/**
 * Danh sách game của site. Trang chủ và thanh tab chuyển game đều đọc từ đây, nên thêm game mới (ví dụ Azur Lane) là thêm một mục ở đây,
 * tạo route group `app/(<game>)/<game>/...` rồi đổi `live` thành true.
 */
export type GameId = "nikke" | "bd2" | "azurlane";

export type GameInfo = {
  id: GameId;
  name: string;
  /** Tên ngắn cho thanh tab. */
  short: string;
  /** Tên rút gọn hơn nữa cho màn hình hẹp. */
  abbr: string;
  href: string;
  tagline: string;
  /** Màu nhấn của game (viền, quầng sáng trên trang chủ). */
  accent: string;
  /** false: chưa có dữ liệu, hiện mờ "sắp có" và không bấm được. */
  live: boolean;
};

export const GAMES: GameInfo[] = [
  {
    id: "nikke",
    name: "Goddess of Victory: NIKKE",
    short: "NIKKE",
    abbr: "NIKKE",
    href: "/nikke",
    tagline: "Đơn vị Nikke dạng Live2D: đổi skin, tư thế đứng, ngắm bắn, nấp, nghe giọng nói và xem kỹ năng.",
    accent: "#f5d90a",
    live: true,
  },
  {
    id: "bd2",
    name: "Brown Dust 2",
    short: "Brown Dust 2",
    abbr: "BD2",
    href: "/bd2",
    tagline: "Trang phục, biểu cảm, cutscene Ultimate, Fated Guest và so sánh hai trang phục cạnh nhau.",
    accent: "#a78bfa",
    live: true,
  },
  {
    id: "azurlane",
    name: "Azur Lane",
    short: "Azur Lane",
    abbr: "AL",
    href: "/azurlane",
    tagline: "Mô hình Live2D của tàu: chạm vào đầu, người hay điểm đặc biệt để xem phản ứng, và chuyển giữa các hoạt cảnh.",
    accent: "#38bdf8",
    live: true,
  },
];
