const STAR_PATH = "M12 2.2l2.9 6.1 6.7.9-4.9 4.6 1.2 6.6L12 17.2l-5.9 3.2 1.2-6.6L2.4 9.2l6.7-.9z";

/** Hạng sao: `value` sao vàng, phần còn lại (tới `max`) là sao mờ. */
export function Stars({ value, max = 5, size = 14, className = "" }: { value: number; max?: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-px ${className}`} role="img" aria-label={`${value} sao`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <path
            d={STAR_PATH}
            fill={i < value ? "var(--star)" : "rgba(255,255,255,0.14)"}
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
