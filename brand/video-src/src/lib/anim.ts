import { Easing, interpolate, spring } from "remotion";

export const clampX = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
export const easeIn = Easing.bezier(0.55, 0, 0.9, 0.35);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 over [a, b] with easing, clamped. */
export const ramp = (f: number, a: number, b: number, ez: (t: number) => number = easeOut) =>
  interpolate(f, [a, b], [0, 1], { ...clampX, easing: ez });

/** Critically damped spring starting at `delay`. */
export const sp = (f: number, delay = 0, stiffness = 140, damping = 22, mass = 1) =>
  spring({ frame: f - delay, fps: 30, config: { stiffness, damping, mass } });

/** Soft overshoot spring for pops. */
export const pop = (f: number, delay = 0) => spring({ frame: f - delay, fps: 30, config: { stiffness: 180, damping: 14, mass: 0.9 } });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type Key = { f: number } & Record<string, number>;

/** Keyframe interpolation (each pair eased); hold by repeating values. */
export const keyed = (f: number, keys: Key[], prop: string, ez: (t: number) => number = inOut): number => {
  if (f <= keys[0].f) return keys[0][prop];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f <= b.f) {
      const t = ez(Math.min(1, Math.max(0, (f - a.f) / Math.max(1, b.f - a.f))));
      return a[prop] + (b[prop] - a[prop]) * t;
    }
  }
  return keys[keys.length - 1][prop];
};

/** In/out envelope: fades in at `a` over `din`, out at `b` over `dout`. */
export const env = (f: number, a: number, b: number, din = 12, dout = 10) =>
  Math.min(ramp(f, a, a + din), 1 - ramp(f, b - dout, b, easeIn));

/** Cubic bezier point. */
export const bez = (p0: number[], p1: number[], p2: number[], p3: number[], t: number) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

/** Duration multiplier exactly as the vault computes it (float; display rounded to 3 dp). */
export const HOUR = 1;
export const H4 = 4;
export const YEAR_H = 8760;
export const durationMult = (hours: number) => 1 + 3 * Math.sqrt(Math.max(0, hours - H4) / (YEAR_H - H4));

/** Early-exit burn fraction: max(5%, 25% × remaining / length). */
export const burnFrac = (elapsedFrac: number) => Math.max(0.05, 0.25 * (1 - elapsedFrac));
