// Project world level into a fixed, pitch-only view. Inversion changes which
// side is ground; a near-vertical horizon can safely leave the visible circle.
export function projectPitchHorizon(pitchDegrees: number) {
  if (!Number.isFinite(pitchDegrees)) return null;
  const radians = (pitchDegrees % 360) * Math.PI / 180;
  const sine = Math.sin(radians), cosine = Math.cos(radians);
  const vertical = Math.abs(cosine) < 0.000001;
  const offset = vertical ? (sine >= 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, 85 * sine / cosine));
  return { offset, groundAbove: !vertical && cosine < 0 };
}

export function formatPitchDegrees(pitchDegrees: number | null) {
  if (pitchDegrees == null || !Number.isFinite(pitchDegrees)) return "—";
  const rounded = Math.round(pitchDegrees);
  return `${rounded < 0 ? "−" : ""}${Math.abs(rounded)}°`;
}
