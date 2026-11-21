import type { AppModule } from '../../app/modules';

/** Luci: registered for the menu structure, hidden until its milestone. */
export const luciModule: AppModule = {
  id: 'luci',
  labelKey: 'module.luci.name',
  visible: false,
  nav: [{ id: 'luci', labelKey: 'module.luci.name', to: '/luci', activePrefix: '/luci' }],
  routes: [],
};
