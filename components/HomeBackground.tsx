import backgroundSmall from "@/public/images/home-map-background-640.webp";
import backgroundLarge from "@/public/images/home-map-background-1024.webp";

// Cover must account for tall screens as well as viewport width. Static imports
// give these pre-compressed assets content-hashed URLs and immutable caching.
const sizes = "(max-aspect-ratio: 2/3) 67vh, 100vw";
const srcSet = `${backgroundSmall.src} 640w, ${backgroundLarge.src} 1024w`;

export function HomeBackground() {
  return (
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundColor: "#050607",
        }}
      >
        {/* Pre-generated WebP avoids runtime conversion; React emits the responsive preload for this high-priority image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundLarge.src}
          srcSet={srcSet}
          sizes={sizes}
          alt=""
          width={1024}
          height={1536}
          fetchPriority="high"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(rgba(0, 0, 0, 0.20), rgba(0, 0, 0, 0.45))",
          }}
        />
      </div>
  );
}
