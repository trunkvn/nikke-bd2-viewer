/**
 * Cánh hoa anh đào rơi chậm phía sau nội dung (chỉ dùng ở trang danh sách, không dùng ở viewer vì sẽ rối mắt và tốn khung hình).
 * Component thuần: vị trí, kích thước, tốc độ cố định theo chỉ số nên không lệch giữa server và client. Tự tắt khi hệ thống bật giảm chuyển động.
 */
export function SakuraPetals({ count = 14 }: { count?: number }) {
  return (
    <div aria-hidden className="bd2-petals">
      {Array.from({ length: count }, (_, i) => {
        const size = 8 + (i % 4) * 2;
        return (
          <i
            key={i}
            className="bd2-petal"
            style={{ left: `${(i * 7.3 + (i % 3) * 5) % 100}%`, width: size, height: size, animationDuration: `${12 + (i % 5) * 3}s`, animationDelay: `${-i * 1.7}s` }}
          />
        );
      })}
    </div>
  );
}
