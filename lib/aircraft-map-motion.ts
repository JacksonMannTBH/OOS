type Position = [number, number];
export type AircraftMotionTarget = {
  position: Position;
  heading: number;
  observedAtMs: number | null;
};
export type AircraftMapMotion = {
  from: Position;
  to: Position;
  fromHeading: number;
  toHeading: number;
  observedAtMs: number | null;
  startedAt: number;
  durationMs: number;
};

export function normalizeHeading(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function shortestHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function sampleAircraftMotion(motion: AircraftMapMotion, now: number) {
  const elapsed = motion.durationMs ? Math.max(0, Math.min(1, (now - motion.startedAt) / motion.durationMs)) : 1;
  // Ease into the observation without overshooting it.
  const progress = 1 - (1 - elapsed) ** 2;
  return {
    position: (elapsed === 1 ? motion.to : [
      motion.from[0] + (motion.to[0] - motion.from[0]) * progress,
      motion.from[1] + (motion.to[1] - motion.from[1]) * progress,
    ]) as Position,
    heading: normalizeHeading(motion.fromHeading + shortestHeadingDelta(motion.fromHeading, motion.toHeading) * progress),
    progress,
    active: elapsed < 1,
  };
}

/** Only interpolate between reported locations; never predict beyond a fix. */
export function updateAircraftMotion(
  previous: AircraftMapMotion | undefined,
  target: AircraftMotionTarget,
  now: number,
  screenDistance: (from: Position, to: Position) => number,
): AircraftMapMotion {
  const heading = normalizeHeading(target.heading);
  if (!previous) {
    return { from: target.position, to: target.position, fromHeading: heading, toHeading: heading,
      observedAtMs: target.observedAtMs, startedAt: now, durationMs: 0 };
  }
  if (target.observedAtMs !== null && previous.observedAtMs !== null && target.observedAtMs < previous.observedAtMs) return previous;
  const observedAtMs = target.observedAtMs ?? previous.observedAtMs;
  if (target.position[0] === previous.to[0] && target.position[1] === previous.to[1] && heading === previous.toHeading) {
    // A fleet refresh or age tick must not prolong an existing movement.
    return observedAtMs === previous.observedAtMs ? previous : { ...previous, observedAtMs };
  }
  const current = sampleAircraftMotion(previous, now);
  const distance = screenDistance(current.position, target.position);
  const durationMs = Math.max(900, Math.min(2_400, 900 + distance * 8));
  return { from: current.position, to: target.position, fromHeading: current.heading, toHeading: heading,
    observedAtMs, startedAt: now, durationMs };
}
