// The two Clima screens, loaded on demand: each gets its own chunk, so the initial bundle stays small.
// The layout's Suspense boundary shows the loading status while a chunk arrives.
import { lazy } from 'react';

export const StanzaScreen = lazy(() =>
  import('../screens/Stanza/StanzaScreen').then((m) => ({ default: m.StanzaScreen })),
);

export const TutteScreen = lazy(() => import('../screens/Tutte/TutteScreen').then((m) => ({ default: m.TutteScreen })));
