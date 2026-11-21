import type { AppModule } from '../../app/modules';

/** Energia: registered for the menu structure, hidden until its milestone. */
export const energiaModule: AppModule = {
  id: 'energia',
  labelKey: 'module.energia.name',
  visible: false,
  nav: [{ id: 'energia', labelKey: 'module.energia.name', to: '/energia', activePrefix: '/energia' }],
  routes: [],
};
