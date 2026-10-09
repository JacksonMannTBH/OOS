import type { ImgHTMLAttributes } from "react";

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | { src: string; width?: number; height?: number }; priority?: boolean; fill?: boolean; unoptimized?: boolean; quality?: number };
export default function Image({ src, priority, fill, unoptimized, quality, style, ...props }: ImageProps) {
  return <img {...props} src={typeof src === "string" ? src : src.src} fetchPriority={priority ? "high" : undefined} style={{ ...(fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}), ...style }} />;
}
