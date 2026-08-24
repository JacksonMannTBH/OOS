import type { CSSProperties } from "react";

const HELICOPTER_ASSET_VERSION = "no-tail-rotor-v1";

type HelicopterIconStyle = CSSProperties & {
  "--ss-heli-animated-image": string;
  "--ss-heli-static-image": string;
};

export function HelicopterIcon({
  heading = 0,
  size = 28,
}: {
  heading?: number;
  size?: number;
}) {
  const assetRoot = "/icons/helicopter/custom-no-tail-rotor";
  const style: HelicopterIconStyle = {
    "--ss-heli-animated-image": `url("${assetRoot}/animated.png?v=${HELICOPTER_ASSET_VERSION}")`,
    "--ss-heli-static-image": `url("${assetRoot}/frame-0.png?v=${HELICOPTER_ASSET_VERSION}")`,
    display: "inline-block",
    width: size,
    height: size,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
    transform: `rotate(${heading}deg)`,
    transformOrigin: "center",
    lineHeight: 0,
  };

  return (
    <span
      role="img"
      aria-label="aircraft"
      className="ss-helicopter-icon"
      style={style}
    />
  );
}
