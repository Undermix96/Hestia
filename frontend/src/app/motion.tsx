/**
 * Motion settings for the whole app.
 *
 * CSS animations (styles/motion.css) stop under `prefers-reduced-motion:
 * reduce` through a media query; Motion components follow the same user
 * setting through `<MotionConfig reducedMotion="user">`.
 */
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

export function AppMotionConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
