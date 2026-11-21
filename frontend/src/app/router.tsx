import { createBrowserRouter, type RouteObject } from 'react-router';
import { KeepSearchNavigate } from './keepSearch';
import { Layout } from './Layout';
import { modules as registry, visibleModules, type AppModule } from './modules';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';

/** Path the app opens on. */
export const DEFAULT_PATH = '/clima/stanza';

/**
 * Route tree: the layout, a redirect from `/`, the routes of every visible
 * module and the not-found page. Exported for tests (memory router).
 */
export function appRoutes(modules: readonly AppModule[] = registry): RouteObject[] {
  return [
    {
      path: '/',
      element: <Layout modules={modules} />,
      errorElement: <RouteError />,
      children: [
        { index: true, element: <KeepSearchNavigate to={DEFAULT_PATH} replace /> },
        ...visibleModules(modules).flatMap((m) => m.routes),
        { path: '*', element: <NotFound /> },
      ],
    },
  ];
}

export function createAppRouter(modules: readonly AppModule[] = registry) {
  return createBrowserRouter(appRoutes(modules));
}
