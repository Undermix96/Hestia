/**
 * Names of the global animation classes defined in motion.css.
 * Components import these constants instead of repeating the strings.
 */
export const MOTION = {
  /** Block entrance (fade + rise); combine with a delay class. */
  enter: 'm-enter',
  /** Entrance delays for the cascade: tabs/summary e1, thermogram/panel e2, bottom row e3. */
  e1: 'm-e1',
  e2: 'm-e2',
  e3: 'm-e3',
  e4: 'm-e4',
  /** `transition: d` on SVG paths whose data changes. */
  morph: 'm-morph',
  /** Measured line reveal (clip-path). */
  drawPast: 'm-drawp',
  /** Forecast line fade-in after the reveal. */
  drawForecast: 'm-drawf',
  /** Program/action bars growing from the left. */
  grow: 'm-grow',
  /** Ring around the dot of an active system. */
  pulse: 'm-pulse',
  /** Glow of the "now" dot. */
  nowPulse: 'm-nowp',
} as const;

export type MotionClass = (typeof MOTION)[keyof typeof MOTION];

/** Entrance classes for a block with the given cascade step (0 = no delay). */
export function enterClass(step: 0 | 1 | 2 | 3 | 4 = 0): string {
  return step === 0 ? MOTION.enter : `${MOTION.enter} m-e${step}`;
}
