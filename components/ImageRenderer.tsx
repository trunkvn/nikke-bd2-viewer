import Image from "next/image";

export function ImageRenderer({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      priority
      draggable={false}
      sizes="(min-width: 1024px) 50vw, 100vw"
      className="pointer-events-none object-contain"
    />
  );
}
