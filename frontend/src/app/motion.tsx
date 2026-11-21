/**
 * Motion settings for the whole app.
 *
 * CSS animations (styles/motion.css) stop under `prefers-reduced-motion:
 * reduce` through a media query; Motion components follow the same user
 * setting through `<MotionConfig reducedMotion="user">`.
 */
import { MotionConfig } from 'motion/react';
import { useSyncExternalStore, type ReactNode } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function mediaQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY)
    : null;
}

function subscribe(onChange: () => void): () => void {
  const query = mediaQuery();
  if (!query) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return mediaQuery()?.matches ?? false;
}

/** True while the user asks for reduced motion (updates live). */
// eslint-disable-next-line react-refresh/only-export-components
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function AppMotionConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
